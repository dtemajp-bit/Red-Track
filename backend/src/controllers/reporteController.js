const ExcelJS = require('exceljs');
const pool = require('../config/db');

const DESDE_MIN = '1900-01-01';
const HASTA_MAX = '2999-12-31';
const GT_OFFSET_MS = 6 * 60 * 60 * 1000; // Guatemala = UTC-6, sin horario de verano

// ---------------------------------------------------------------------------
// Filtros comunes: ?desde=AAAA-MM-DD&hasta=AAAA-MM-DD&id_zona=&id_tecnico=
// Un técnico solo ve su propia fila en el reporte de desempeño.
// ---------------------------------------------------------------------------
function leerFiltros(req) {
  const fecha = (v, porDefecto) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? v : porDefecto);
  const entero = (v) => (Number.isInteger(Number(v)) && Number(v) > 0 ? Number(v) : null);

  return {
    desde: fecha(req.query.desde, DESDE_MIN),
    hasta: fecha(req.query.hasta, HASTA_MAX),
    id_zona: entero(req.query.id_zona),
    id_tecnico: entero(req.query.id_tecnico),
    desdeTexto: fecha(req.query.desde, ''),
    hastaTexto: fecha(req.query.hasta, ''),
    // Para el reporte de desempeño, un técnico solo se ve a sí mismo.
    soloYo: req.usuario && req.usuario.rol === 'tecnico' ? req.usuario.id_usuario : null,
  };
}

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------
async function consultarDesempeno(f) {
  const donde = ["rol.nombre = 'tecnico'"];
  const params = [];
  for (let i = 0; i < 7; i++) params.push(f.desde, f.hasta);

  const idTecnico = f.soloYo || f.id_tecnico;
  if (f.id_zona) {
    donde.push('u.id_zona = ?');
    params.push(f.id_zona);
  }
  if (idTecnico) {
    donde.push('u.id_usuario = ?');
    params.push(idTecnico);
  }

  const [filas] = await pool.query(
    `SELECT u.id_usuario, u.nombre_completo AS tecnico, u.activo,
            COALESCE(z.nombre, 'Sin zona') AS zona,
            (SELECT COUNT(*) FROM rutas r
              WHERE r.id_tecnico = u.id_usuario AND r.fecha_programada BETWEEN ? AND ?) AS rutas,
            (SELECT COUNT(*) FROM rutas r
              WHERE r.id_tecnico = u.id_usuario AND r.estado = 'completada'
                AND r.fecha_programada BETWEEN ? AND ?) AS rutas_completadas,
            (SELECT COUNT(*) FROM rutas r JOIN ruta_nodos rn ON rn.id_ruta = r.id_ruta
              WHERE r.id_tecnico = u.id_usuario AND r.fecha_programada BETWEEN ? AND ?) AS puntos,
            (SELECT COUNT(*) FROM rutas r JOIN ruta_nodos rn ON rn.id_ruta = r.id_ruta
              WHERE r.id_tecnico = u.id_usuario AND rn.visitado = TRUE
                AND r.fecha_programada BETWEEN ? AND ?) AS puntos_visitados,
            (SELECT COUNT(*) FROM nodos n
              WHERE n.id_usuario_registra = u.id_usuario AND DATE(n.creado_en) BETWEEN ? AND ?) AS nodos_registrados,
            (SELECT COUNT(*) FROM incidencias i
              WHERE i.id_usuario_reporta = u.id_usuario AND DATE(i.creado_en) BETWEEN ? AND ?) AS incidencias,
            (SELECT COUNT(*) FROM incidencias i
              WHERE i.id_usuario_reporta = u.id_usuario AND i.estado IN ('resuelta', 'cerrada')
                AND DATE(i.creado_en) BETWEEN ? AND ?) AS incidencias_resueltas,
            (SELECT MAX(n.creado_en) FROM nodos n WHERE n.id_usuario_registra = u.id_usuario) AS ultimo_nodo,
            (SELECT MAX(i.creado_en) FROM incidencias i WHERE i.id_usuario_reporta = u.id_usuario) AS ultima_incidencia
     FROM usuarios u
     JOIN roles rol ON u.id_rol = rol.id_rol
     LEFT JOIN zonas z ON u.id_zona = z.id_zona
     WHERE ${donde.join(' AND ')}
     ORDER BY u.nombre_completo`,
    params
  );

  return filas.map((r) => {
    const puntos = Number(r.puntos);
    const fechas = [r.ultimo_nodo, r.ultima_incidencia].filter(Boolean).map((d) => new Date(d));
    const ultima = fechas.length ? new Date(Math.max(...fechas)) : null;
    const { ultimo_nodo, ultima_incidencia, ...resto } = r; // eslint-disable-line no-unused-vars
    return {
      ...resto,
      cumplimiento: puntos > 0 ? Math.round((Number(r.puntos_visitados) / puntos) * 1000) / 10 : 0,
      ultima_actividad: ultima,
    };
  });
}

async function consultarInfraestructuraPorZona(f) {
  const donde = ['DATE(n.creado_en) BETWEEN ? AND ?'];
  const params = [f.desde, f.hasta];
  if (f.id_zona) {
    donde.push('n.id_zona = ?');
    params.push(f.id_zona);
  }
  if (f.id_tecnico) {
    donde.push('n.id_usuario_registra = ?');
    params.push(f.id_tecnico);
  }
  const [filas] = await pool.query(
    `SELECT COALESCE(z.nombre, 'Sin zona') AS zona,
            COUNT(*) AS total,
            SUM(n.estado = 'activo') AS activos,
            SUM(n.estado = 'mantenimiento') AS en_mantenimiento,
            SUM(n.estado = 'inactivo') AS inactivos
     FROM nodos n
     LEFT JOIN zonas z ON n.id_zona = z.id_zona
     WHERE ${donde.join(' AND ')}
     GROUP BY z.id_zona, z.nombre
     ORDER BY zona`,
    params
  );
  return filas;
}

async function consultarIncidenciasPorZona(f) {
  const donde = ['DATE(i.creado_en) BETWEEN ? AND ?'];
  const params = [f.desde, f.hasta];
  if (f.id_zona) {
    donde.push('z.id_zona = ?');
    params.push(f.id_zona);
  }
  if (f.id_tecnico) {
    donde.push('i.id_usuario_reporta = ?');
    params.push(f.id_tecnico);
  }
  const [filas] = await pool.query(
    `SELECT COALESCE(z.nombre, 'Sin zona') AS zona,
            COUNT(*) AS total,
            SUM(i.estado = 'abierta') AS abiertas,
            SUM(i.estado = 'en_atencion') AS en_atencion,
            SUM(i.estado IN ('resuelta', 'cerrada')) AS resueltas
     FROM incidencias i
     LEFT JOIN nodos n ON i.id_nodo = n.id_nodo
     LEFT JOIN usuarios ur ON i.id_usuario_reporta = ur.id_usuario
     LEFT JOIN zonas z ON z.id_zona = COALESCE(n.id_zona, ur.id_zona)
     WHERE ${donde.join(' AND ')}
     GROUP BY z.id_zona, z.nombre
     ORDER BY zona`,
    params
  );
  return filas;
}

async function consultarDetalleNodos(f) {
  const donde = ['DATE(n.creado_en) BETWEEN ? AND ?'];
  const params = [f.desde, f.hasta];
  if (f.id_zona) {
    donde.push('n.id_zona = ?');
    params.push(f.id_zona);
  }
  if (f.id_tecnico) {
    donde.push('n.id_usuario_registra = ?');
    params.push(f.id_tecnico);
  }
  const [filas] = await pool.query(
    `SELECT n.codigo, n.tipo, n.estado, COALESCE(z.nombre, 'Sin zona') AS zona,
            n.latitud, n.longitud, COALESCE(u.nombre_completo, 'Sin registrar') AS registrado_por,
            n.creado_en, n.capturado_en, n.observaciones
     FROM nodos n
     LEFT JOIN zonas z ON n.id_zona = z.id_zona
     LEFT JOIN usuarios u ON n.id_usuario_registra = u.id_usuario
     WHERE ${donde.join(' AND ')}
     ORDER BY n.creado_en DESC`,
    params
  );
  return filas;
}

async function consultarDetalleIncidencias(f) {
  const donde = ['DATE(i.creado_en) BETWEEN ? AND ?'];
  const params = [f.desde, f.hasta];
  if (f.id_zona) {
    donde.push('z.id_zona = ?');
    params.push(f.id_zona);
  }
  if (f.id_tecnico) {
    donde.push('i.id_usuario_reporta = ?');
    params.push(f.id_tecnico);
  }
  const [filas] = await pool.query(
    `SELECT i.id_incidencia, i.descripcion, i.prioridad, i.estado,
            n.codigo AS codigo_nodo, COALESCE(z.nombre, 'Sin zona') AS zona,
            ur.nombre_completo AS reportado_por, i.creado_en, i.resuelto_en
     FROM incidencias i
     LEFT JOIN nodos n ON i.id_nodo = n.id_nodo
     JOIN usuarios ur ON i.id_usuario_reporta = ur.id_usuario
     LEFT JOIN zonas z ON z.id_zona = COALESCE(n.id_zona, ur.id_zona)
     WHERE ${donde.join(' AND ')}
     ORDER BY i.creado_en DESC`,
    params
  );
  return filas;
}

async function consultarDetalleRutas(f) {
  const donde = ['r.fecha_programada BETWEEN ? AND ?'];
  const params = [f.desde, f.hasta];
  if (f.id_zona) {
    donde.push('u.id_zona = ?');
    params.push(f.id_zona);
  }
  if (f.id_tecnico) {
    donde.push('r.id_tecnico = ?');
    params.push(f.id_tecnico);
  }
  const [filas] = await pool.query(
    `SELECT r.nombre, u.nombre_completo AS tecnico, r.fecha_programada, r.estado,
            COUNT(rn.id_ruta_nodo) AS puntos, COALESCE(SUM(rn.visitado), 0) AS visitados
     FROM rutas r
     JOIN usuarios u ON r.id_tecnico = u.id_usuario
     LEFT JOIN ruta_nodos rn ON rn.id_ruta = r.id_ruta
     WHERE ${donde.join(' AND ')}
     GROUP BY r.id_ruta, r.nombre, u.nombre_completo, r.fecha_programada, r.estado
     ORDER BY r.fecha_programada DESC, r.id_ruta DESC`,
    params
  );
  return filas;
}

// ---------------------------------------------------------------------------
// Endpoints JSON (los usan la web y la app móvil)
// ---------------------------------------------------------------------------
function responder(consulta) {
  return async (req, res) => {
    try {
      res.json(await consulta(leerFiltros(req)));
    } catch (error) {
      console.error('Error en reporte:', error);
      res.status(500).json({ mensaje: 'Error interno del servidor' });
    }
  };
}

const infraestructuraPorZona = responder(consultarInfraestructuraPorZona);
const incidenciasPorZona = responder(consultarIncidenciasPorZona);
// "rutas-por-tecnico" se conserva por compatibilidad con la app móvil: devuelve
// los mismos campos de antes más las métricas nuevas.
const desempenoPorTecnico = responder(consultarDesempeno);

// ---------------------------------------------------------------------------
// Exportación a Excel con formato
// ---------------------------------------------------------------------------
const COLOR = {
  navy: 'FF0F1B2E',
  celeste: 'FF22B8D9',
  celesteClaro: 'FFE3F7FB',
  zebra: 'FFF4F6F9',
  borde: 'FFD5DAE3',
  texto: 'FF1C2333',
  gris: 'FF6B7385',
  verde: 'FFE3F7EC',
  verdeTxt: 'FF17A35A',
  naranja: 'FFFDF1DD',
  naranjaTxt: 'FFB86F0A',
  rojo: 'FFFBE8E5',
  rojoTxt: 'FFD5432F',
  celesteTxt: 'FF0E93B0',
};

const BORDE = {
  top: { style: 'thin', color: { argb: COLOR.borde } },
  left: { style: 'thin', color: { argb: COLOR.borde } },
  bottom: { style: 'thin', color: { argb: COLOR.borde } },
  right: { style: 'thin', color: { argb: COLOR.borde } },
};

const ETIQUETA = {
  poste: 'Poste',
  nodo_central: 'Nodo central',
  caja_distribucion: 'Caja de distribución',
  activo: 'Activo',
  inactivo: 'Inactivo',
  mantenimiento: 'En mantenimiento',
  abierta: 'Abierta',
  en_atencion: 'En atención',
  resuelta: 'Resuelta',
  cerrada: 'Cerrada',
  pendiente: 'Pendiente',
  en_progreso: 'En progreso',
  completada: 'Completada',
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
  critica: 'Crítica',
};
const etiqueta = (v) => ETIQUETA[v] || v || '';

const TONO = {
  Activo: ['verde', 'verdeTxt'],
  Completada: ['verde', 'verdeTxt'],
  Resuelta: ['verde', 'verdeTxt'],
  Cerrada: ['verde', 'verdeTxt'],
  Baja: ['verde', 'verdeTxt'],
  'En progreso': ['celesteClaro', 'celesteTxt'],
  'En atención': ['celesteClaro', 'celesteTxt'],
  Media: ['celesteClaro', 'celesteTxt'],
  Pendiente: ['naranja', 'naranjaTxt'],
  Abierta: ['naranja', 'naranjaTxt'],
  'En mantenimiento': ['naranja', 'naranjaTxt'],
  Alta: ['naranja', 'naranjaTxt'],
  Inactivo: ['rojo', 'rojoTxt'],
  Crítica: ['rojo', 'rojoTxt'],
};

const relleno = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });

// Hora local de Guatemala escrita en la celda (Excel no guarda zona horaria).
function aHoraGT(valor) {
  if (!valor) return null;
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getTime() - GT_OFFSET_MS);
}

function textoFiltros(f, nombreZona, nombreTecnico) {
  const periodo =
    f.desdeTexto || f.hastaTexto
      ? `Periodo: ${f.desdeTexto || 'inicio'} a ${f.hastaTexto || 'hoy'}`
      : 'Periodo: todo el historial';
  return `${periodo}   ·   Zona: ${nombreZona || 'todas'}   ·   Técnico: ${nombreTecnico || 'todos'}`;
}

function alturaFila(columnas, fila) {
  const ajustable = columnas.find((c) => c.ajustar);
  if (!ajustable) return 20;
  const texto = String(ajustable.valor ? ajustable.valor(fila) : fila[ajustable.clave] || '');
  const lineas = Math.max(1, Math.ceil(texto.length / ((ajustable.ancho || 40) * 1.1)));
  return Math.min(90, 18 * lineas + 2);
}

// Crea una hoja con título, subtítulo y una tabla con formato.
// columnas: [{ titulo, clave, ancho, formato, alineacion, tono, numerico, ajustar, valor, total }]
function agregarTabla(libro, nombreHoja, titulo, subtitulo, columnas, filas, opciones = {}) {
  const hoja = libro.addWorksheet(nombreHoja, {
    views: [{ state: 'frozen', ySplit: 4, showGridLines: false }],
    properties: { tabColor: { argb: COLOR.celeste } },
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
  });
  const n = columnas.length;
  hoja.columns = columnas.map((c) => ({ width: c.ancho || 16 }));

  hoja.mergeCells(1, 1, 1, n);
  const t = hoja.getCell(1, 1);
  t.value = titulo;
  t.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  t.fill = relleno(COLOR.navy);
  t.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  hoja.getRow(1).height = 30;

  hoja.mergeCells(2, 1, 2, n);
  const s = hoja.getCell(2, 1);
  s.value = subtitulo;
  s.font = { name: 'Calibri', size: 10, color: { argb: COLOR.gris } };
  s.fill = relleno(COLOR.celesteClaro);
  s.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  hoja.getRow(2).height = 20;
  hoja.getRow(3).height = 6;

  const encabezado = hoja.getRow(4);
  columnas.forEach((c, i) => {
    const celda = encabezado.getCell(i + 1);
    celda.value = c.titulo;
    celda.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    celda.fill = relleno(COLOR.navy);
    celda.alignment = { vertical: 'middle', horizontal: c.alineacion || (c.numerico ? 'center' : 'left'), wrapText: true };
    celda.border = BORDE;
  });
  encabezado.height = 30;

  filas.forEach((fila, idx) => {
    const r = hoja.getRow(5 + idx);
    columnas.forEach((c, i) => {
      const celda = r.getCell(i + 1);
      const bruto = c.valor ? c.valor(fila) : fila[c.clave];
      celda.value = bruto === undefined || bruto === null || bruto === '' ? (c.numerico ? 0 : '—') : bruto;
      celda.font = { name: 'Calibri', size: 11, color: { argb: COLOR.texto }, bold: i === 0 };
      celda.alignment = {
        vertical: 'middle',
        horizontal: c.alineacion || (c.numerico ? 'center' : 'left'),
        wrapText: Boolean(c.ajustar),
      };
      celda.border = BORDE;
      if (c.formato) celda.numFmt = c.formato;
      celda.fill = relleno(idx % 2 === 0 ? 'FFFFFFFF' : COLOR.zebra);
      if (c.tono && TONO[celda.value]) {
        const [fondo, txt] = TONO[celda.value];
        celda.fill = relleno(COLOR[fondo]);
        celda.font = { name: 'Calibri', size: 11, bold: true, color: { argb: COLOR[txt] } };
        celda.alignment = { vertical: 'middle', horizontal: 'center' };
      }
    });
    r.height = alturaFila(columnas, fila);
  });

  const ultimaDatos = 4 + filas.length;
  if (opciones.totales && filas.length > 0) {
    const r = hoja.getRow(ultimaDatos + 1);
    columnas.forEach((c, i) => {
      const celda = r.getCell(i + 1);
      if (i === 0) celda.value = 'TOTAL';
      else if (c.total === 'suma') {
        const letra = hoja.getColumn(i + 1).letter;
        celda.value = { formula: `SUM(${letra}5:${letra}${ultimaDatos})` };
      } else if (c.total && c.total.formula) {
        celda.value = { formula: c.total.formula(ultimaDatos + 1) };
      }
      celda.font = { name: 'Calibri', size: 11, bold: true, color: { argb: COLOR.navy } };
      celda.fill = relleno(COLOR.celesteClaro);
      celda.alignment = { vertical: 'middle', horizontal: i === 0 ? 'left' : 'center' };
      celda.border = { ...BORDE, top: { style: 'medium', color: { argb: COLOR.navy } } };
      if (c.formato) celda.numFmt = c.formato;
    });
    r.height = 22;
  }

  if (filas.length === 0) {
    hoja.mergeCells(5, 1, 5, n);
    const vacio = hoja.getCell(5, 1);
    vacio.value = 'No hay datos para los filtros elegidos.';
    vacio.font = { italic: true, color: { argb: COLOR.gris } };
    vacio.alignment = { horizontal: 'center' };
  } else {
    hoja.autoFilter = { from: { row: 4, column: 1 }, to: { row: ultimaDatos, column: n } };
  }
  return hoja;
}

function hojaResumen(libro, textoF, desempeno, infra, incs) {
  const hoja = libro.addWorksheet('Resumen', {
    views: [{ showGridLines: false }],
    properties: { tabColor: { argb: COLOR.navy } },
    pageSetup: { orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
  });
  hoja.columns = [{ width: 34 }, { width: 18 }, { width: 4 }, { width: 34 }, { width: 18 }];

  hoja.mergeCells('A1:E1');
  const t = hoja.getCell('A1');
  t.value = 'RED-TRACK · Reporte gerencial';
  t.font = { name: 'Calibri', size: 20, bold: true, color: { argb: 'FFFFFFFF' } };
  t.fill = relleno(COLOR.navy);
  t.alignment = { vertical: 'middle', indent: 1 };
  hoja.getRow(1).height = 38;

  hoja.mergeCells('A2:E2');
  const s = hoja.getCell('A2');
  s.value = textoF;
  s.font = { size: 10, color: { argb: COLOR.gris } };
  s.fill = relleno(COLOR.celesteClaro);
  s.alignment = { vertical: 'middle', indent: 1 };
  hoja.getRow(2).height = 20;

  hoja.mergeCells('A3:E3');
  const g = hoja.getCell('A3');
  g.value = `Generado el ${new Date().toLocaleString('es-GT', { timeZone: 'America/Guatemala' })}`;
  g.font = { size: 9, italic: true, color: { argb: COLOR.gris } };
  g.alignment = { indent: 1 };

  const suma = (arr, k) => arr.reduce((a, x) => a + Number(x[k] || 0), 0);
  const puntos = suma(desempeno, 'puntos');
  const visitados = suma(desempeno, 'puntos_visitados');
  const sinResolver = suma(incs, 'abiertas') + suma(incs, 'en_atencion');

  const bloque = (fila, columna, titulo, items) => {
    hoja.mergeCells(fila, columna, fila, columna + 1);
    const h = hoja.getCell(fila, columna);
    h.value = titulo;
    h.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
    h.fill = relleno(COLOR.celeste);
    h.alignment = { indent: 1, vertical: 'middle' };
    hoja.getRow(fila).height = 22;
    items.forEach(([nombre, valor, formato], i) => {
      const a = hoja.getCell(fila + 1 + i, columna);
      const b = hoja.getCell(fila + 1 + i, columna + 1);
      a.value = nombre;
      b.value = valor;
      if (formato) b.numFmt = formato;
      [a, b].forEach((c) => {
        c.fill = relleno(i % 2 === 0 ? 'FFFFFFFF' : COLOR.zebra);
        c.border = BORDE;
        c.font = { size: 11, color: { argb: COLOR.texto } };
      });
      a.alignment = { indent: 1, vertical: 'middle' };
      b.alignment = { horizontal: 'center', vertical: 'middle' };
      b.font = { size: 12, bold: true, color: { argb: COLOR.navy } };
      hoja.getRow(fila + 1 + i).height = 22;
    });
  };

  bloque(5, 1, 'Equipo técnico', [
    ['Técnicos en el reporte', desempeno.length],
    ['Rutas asignadas', suma(desempeno, 'rutas')],
    ['Rutas completadas', suma(desempeno, 'rutas_completadas')],
    ['Puntos visitados / asignados', `${visitados} / ${puntos}`],
    ['Cumplimiento global', puntos > 0 ? visitados / puntos : 0, '0.0%'],
  ]);
  bloque(5, 4, 'Operación en campo', [
    ['Infraestructura registrada', suma(infra, 'total')],
    ['   Activa', suma(infra, 'activos')],
    ['   En mantenimiento', suma(infra, 'en_mantenimiento')],
    ['Incidencias reportadas', suma(incs, 'total')],
    ['Incidencias sin resolver', sinResolver],
  ]);

  hoja.mergeCells('A12:E12');
  const nota = hoja.getCell('A12');
  nota.value =
    'Hojas incluidas: Desempeño por técnico · Infraestructura por zona · Incidencias por zona · Detalle de rutas · Detalle de infraestructura · Detalle de incidencias.';
  nota.font = { size: 9, italic: true, color: { argb: COLOR.gris } };
  nota.alignment = { wrapText: true, vertical: 'top', indent: 1 };
  hoja.getRow(12).height = 28;
}

async function exportarExcel(req, res) {
  try {
    const f = leerFiltros(req);
    // Un técnico exporta solo sus propios datos en todas las hojas.
    if (f.soloYo) f.id_tecnico = f.soloYo;

    const [desempeno, infra, incs, rutas, nodos, incidencias] = await Promise.all([
      consultarDesempeno(f),
      consultarInfraestructuraPorZona(f),
      consultarIncidenciasPorZona(f),
      consultarDetalleRutas(f),
      consultarDetalleNodos(f),
      consultarDetalleIncidencias(f),
    ]);

    let nombreZona = null;
    let nombreTecnico = null;
    if (f.id_zona) {
      const [[z]] = await pool.query('SELECT nombre FROM zonas WHERE id_zona = ?', [f.id_zona]);
      nombreZona = z && z.nombre;
    }
    if (f.id_tecnico) {
      const [[u]] = await pool.query('SELECT nombre_completo FROM usuarios WHERE id_usuario = ?', [f.id_tecnico]);
      nombreTecnico = u && u.nombre_completo;
    }
    const textoF = textoFiltros(f, nombreZona, nombreTecnico);

    const libro = new ExcelJS.Workbook();
    libro.creator = 'Red-Track';
    libro.created = new Date();

    hojaResumen(libro, textoF, desempeno, infra, incs);

    const hojaDes = agregarTabla(
      libro,
      'Desempeño por técnico',
      'Desempeño por técnico',
      textoF,
      [
        { titulo: 'Técnico', clave: 'tecnico', ancho: 30 },
        { titulo: 'Zona', clave: 'zona', ancho: 16 },
        { titulo: 'Rutas asignadas', clave: 'rutas', ancho: 13, numerico: true, total: 'suma' },
        { titulo: 'Rutas completadas', clave: 'rutas_completadas', ancho: 13, numerico: true, total: 'suma' },
        { titulo: 'Puntos asignados', clave: 'puntos', ancho: 13, numerico: true, total: 'suma' },
        { titulo: 'Puntos visitados', clave: 'puntos_visitados', ancho: 13, numerico: true, total: 'suma' },
        {
          titulo: '% cumplimiento',
          ancho: 14,
          numerico: true,
          formato: '0.0%',
          valor: (r) => Number(r.cumplimiento) / 100,
          total: { formula: (fila) => `IF(E${fila}>0,F${fila}/E${fila},0)` },
        },
        { titulo: 'Infraestructura registrada', clave: 'nodos_registrados', ancho: 15, numerico: true, total: 'suma' },
        { titulo: 'Incidencias reportadas', clave: 'incidencias', ancho: 13, numerico: true, total: 'suma' },
        { titulo: 'Incidencias resueltas', clave: 'incidencias_resueltas', ancho: 13, numerico: true, total: 'suma' },
        {
          titulo: 'Última actividad',
          ancho: 18,
          formato: 'dd/mm/yyyy hh:mm',
          alineacion: 'center',
          valor: (r) => aHoraGT(r.ultima_actividad) || 'Sin actividad',
        },
        { titulo: 'Estado', ancho: 11, alineacion: 'center', tono: true, valor: (r) => (r.activo ? 'Activo' : 'Inactivo') },
      ],
      desempeno,
      { totales: true }
    );
    if (desempeno.length > 0) {
      hojaDes.addConditionalFormatting({
        ref: `G5:G${4 + desempeno.length}`,
        rules: [
          {
            type: 'dataBar',
            gradient: false,
            cfvo: [
              { type: 'num', value: 0 },
              { type: 'num', value: 1 },
            ],
            color: { argb: 'FF7FD6E8' },
          },
        ],
      });
    }

    agregarTabla(
      libro,
      'Infraestructura por zona',
      'Infraestructura por zona',
      textoF,
      [
        { titulo: 'Zona', clave: 'zona', ancho: 28 },
        { titulo: 'Total de puntos', clave: 'total', ancho: 16, numerico: true, total: 'suma' },
        { titulo: 'Activos', clave: 'activos', ancho: 14, numerico: true, total: 'suma' },
        { titulo: 'En mantenimiento', clave: 'en_mantenimiento', ancho: 18, numerico: true, total: 'suma' },
        { titulo: 'Inactivos', clave: 'inactivos', ancho: 14, numerico: true, total: 'suma' },
      ],
      infra,
      { totales: true }
    );

    agregarTabla(
      libro,
      'Incidencias por zona',
      'Incidencias por zona',
      textoF,
      [
        { titulo: 'Zona', clave: 'zona', ancho: 28 },
        { titulo: 'Total incidencias', clave: 'total', ancho: 17, numerico: true, total: 'suma' },
        { titulo: 'Abiertas', clave: 'abiertas', ancho: 14, numerico: true, total: 'suma' },
        { titulo: 'En atención', clave: 'en_atencion', ancho: 14, numerico: true, total: 'suma' },
        { titulo: 'Resueltas', clave: 'resueltas', ancho: 14, numerico: true, total: 'suma' },
      ],
      incs,
      { totales: true }
    );

    agregarTabla(
      libro,
      'Detalle de rutas',
      'Detalle de rutas',
      textoF,
      [
        { titulo: 'Ruta', clave: 'nombre', ancho: 30 },
        { titulo: 'Técnico', clave: 'tecnico', ancho: 28 },
        {
          titulo: 'Fecha programada',
          ancho: 17,
          alineacion: 'center',
          formato: 'dd/mm/yyyy',
          valor: (r) => new Date(`${r.fecha_programada}T00:00:00Z`),
        },
        { titulo: 'Estado', ancho: 14, alineacion: 'center', tono: true, valor: (r) => etiqueta(r.estado) },
        { titulo: 'Puntos', clave: 'puntos', ancho: 10, numerico: true },
        { titulo: 'Visitados', clave: 'visitados', ancho: 11, numerico: true },
        {
          titulo: '% avance',
          ancho: 11,
          numerico: true,
          formato: '0%',
          valor: (r) => (Number(r.puntos) > 0 ? Number(r.visitados) / Number(r.puntos) : 0),
        },
      ],
      rutas
    );

    agregarTabla(
      libro,
      'Detalle de infraestructura',
      'Detalle de infraestructura registrada',
      textoF,
      [
        { titulo: 'Código', clave: 'codigo', ancho: 16 },
        { titulo: 'Tipo', ancho: 20, valor: (r) => etiqueta(r.tipo) },
        { titulo: 'Estado', ancho: 17, alineacion: 'center', tono: true, valor: (r) => etiqueta(r.estado) },
        { titulo: 'Zona', clave: 'zona', ancho: 16 },
        { titulo: 'Latitud', clave: 'latitud', ancho: 12, numerico: true, formato: '0.0000000' },
        { titulo: 'Longitud', clave: 'longitud', ancho: 12, numerico: true, formato: '0.0000000' },
        { titulo: 'Registrado por', clave: 'registrado_por', ancho: 26 },
        { titulo: 'Fecha de registro', ancho: 18, alineacion: 'center', formato: 'dd/mm/yyyy hh:mm', valor: (r) => aHoraGT(r.creado_en) },
        {
          titulo: 'Origen',
          ancho: 22,
          alineacion: 'center',
          valor: (r) => (r.capturado_en && new Date(r.creado_en) - new Date(r.capturado_en) > 120000 ? 'Guardado sin conexión' : 'En línea'),
        },
        { titulo: 'Observaciones', clave: 'observaciones', ancho: 40, ajustar: true },
      ],
      nodos
    );

    agregarTabla(
      libro,
      'Detalle de incidencias',
      'Detalle de incidencias',
      textoF,
      [
        { titulo: 'Código', ancho: 12, valor: (r) => `INC-${String(r.id_incidencia).padStart(4, '0')}` },
        { titulo: 'Descripción', clave: 'descripcion', ancho: 48, ajustar: true },
        { titulo: 'Prioridad', ancho: 12, alineacion: 'center', tono: true, valor: (r) => etiqueta(r.prioridad) },
        { titulo: 'Estado', ancho: 14, alineacion: 'center', tono: true, valor: (r) => etiqueta(r.estado) },
        { titulo: 'Punto', clave: 'codigo_nodo', ancho: 14 },
        { titulo: 'Zona', clave: 'zona', ancho: 16 },
        { titulo: 'Reportado por', clave: 'reportado_por', ancho: 26 },
        { titulo: 'Fecha de reporte', ancho: 18, alineacion: 'center', formato: 'dd/mm/yyyy hh:mm', valor: (r) => aHoraGT(r.creado_en) },
        {
          titulo: 'Fecha de resolución',
          ancho: 18,
          alineacion: 'center',
          formato: 'dd/mm/yyyy hh:mm',
          valor: (r) => aHoraGT(r.resuelto_en) || 'Pendiente',
        },
      ],
      incidencias
    );

    const hoy = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="red-track-reporte-${hoy}.xlsx"`);
    await libro.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error al exportar Excel:', error);
    if (!res.headersSent) res.status(500).json({ mensaje: 'No se pudo generar el Excel' });
  }
}

module.exports = {
  infraestructuraPorZona,
  incidenciasPorZona,
  rutasPorTecnico: desempenoPorTecnico,
  desempenoPorTecnico,
  exportarExcel,
};
