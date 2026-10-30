// Catálogos que vienen cargados de fábrica en Red-Track: mano de obra y materiales de uso común.
// Se fusionan con lo que el administrador ya tenga: nunca se duplica ni se pisa un registro existente
// (se compara por código o por descripción, sin importar mayúsculas).

const MANO_OBRA = [
  'Instalación triple',
  'Instalación doble',
  'Instalación adicional TV',
  'Traslado interno',
  'Traslado externo',
  'Traslado acometida completa',
  'Traslado triple',
  'Traslado doble',
  'Instalación línea telefónica',
].map((descripcion) => ({ descripcion }));

const m = (codigo, descripcion, unidad = 'UND', con_serie = 0) => ({ codigo, descripcion, unidad, con_serie });
const MATERIALES = [
  m('XIM-X1001', 'APARATO TELEFONICO XIM X1001', 'UND', 1),
  m('SEI800AMX', 'BUNDLE STB IPTV SEI800AMX+CONTROL', 'UND', 1),
  m('ZTE-B866V2H', 'BUNDLE ZTE B866V2-H + CONTROL', 'UND', 1),
  m('CAB-TEL-2H', 'CABLE TELEFONICO XIM TECH PLANO 2 HILOS', 'M'),
  m('CAB-UTP5E', 'CABLE UTP CATEGORIA 5E DE 4" 0.51 MM', 'M'),
  m('CABLEDROP-YOFC', 'CABLEDROP YOFC 001FLATFIG8 GJYXFCH-1B6a1', 'M'),
  m('RJ11', 'CONECTOR RJ11'),
  m('1AB074610027', 'CONECTOR RJ45 CAT 5E 1AB074610027'),
  m('8802-T', 'CONECTOR SIN HERRAMI 8802-T/1.6-3 SC/APC'),
  m('H5SA2001', 'FHTEK HOUSING MECANICO H5SA2001'),
  m('FPF-PAA-01', 'FHTEK SCAPC MECANICO FPF-PAA-01'),
  m('GRAPA-GS5', 'GRAPA CIRCULAR GS 5MM P/CABLE UTP5E'),
  m('GRAPA-NG3', 'GRAPA CIRCULAR NG 3MM P/CABLE MOAV ADSS'),
  m('GRAPA-PLANA-FRP', 'GRAPA PLANA NG P/CABLE DROP FO TIPO FRP'),
  m('5129', 'HERRAJE REMATE HYPOCLAMP AOTV 8-4MM 5129'),
  m('DESBAL-100M', 'HUAWEI DESBAL CABLE AEREODUCTO DROP 100M'),
  m('DESBAL-150M', 'HUAWEI DESBAL CABLE AEREODUCTO DROP 150M'),
  m('DESBAL-200M', 'HUAWEI DESBAL CABLE AEREODUCTO DROP 200M'),
  m('HG8145X6-10', 'ONT GPON HUAWEI HG8145X6-10', 'UND', 1),
  m('ROSETA-SCAPC', 'ROSETA OPTICA SC/APC'),
  m('SOP-TV-CELFAST', 'SOPORTE PARA TV IPTV CELFAST'),
  m('DGS105', 'SWITCH DLINK DGS105', 'UND', 1),
];

const TABLAS = {
  materiales: { id: 'id_material', prefijo: 'MAT' },
  mano_obra_catalogo: { id: 'id_mano_obra', prefijo: 'MO' },
};

// Agrega los registros que falten. Devuelve cuántos se agregaron y cuántos ya existían.
async function fusionarCatalogo(db, tabla, items) {
  const { prefijo } = TABLAS[tabla];
  const [existentes] = await db.query(`SELECT codigo, descripcion FROM ${tabla}`);
  const codigos = new Set(existentes.map((e) => e.codigo.toLowerCase()));
  const descripciones = new Set(existentes.map((e) => e.descripcion.trim().toLowerCase()));
  const patron = new RegExp(`^${prefijo}-(\\d+)$`, 'i');
  let siguiente = 1 + Math.max(0, ...existentes.map((e) => (patron.exec(e.codigo) ? Number(patron.exec(e.codigo)[1]) : 0)));
  let agregados = 0;
  let existian = 0;
  for (const it of items) {
    const descripcion = String(it.descripcion || '').trim().slice(0, 255);
    if (!descripcion) continue;
    const codigoDado = it.codigo ? String(it.codigo).trim().slice(0, 60) : '';
    if (descripciones.has(descripcion.toLowerCase()) || (codigoDado && codigos.has(codigoDado.toLowerCase()))) {
      existian += 1;
      continue;
    }
    let codigo = codigoDado;
    while (!codigo || codigos.has(codigo.toLowerCase())) {
      codigo = `${prefijo}-${String(siguiente).padStart(3, '0')}`;
      siguiente += 1;
    }
    const unidad = String(it.unidad || 'UND').trim().slice(0, 20) || 'UND';
    if (tabla === 'materiales') {
      await db.query('INSERT INTO materiales (codigo, descripcion, unidad, con_serie) VALUES (?, ?, ?, ?)', [codigo, descripcion, unidad, it.con_serie ? 1 : 0]);
    } else {
      await db.query('INSERT INTO mano_obra_catalogo (codigo, descripcion, unidad) VALUES (?, ?, ?)', [codigo, descripcion, unidad]);
    }
    codigos.add(codigo.toLowerCase());
    descripciones.add(descripcion.toLowerCase());
    agregados += 1;
  }
  return { agregados, existian };
}

// Convierte texto pegado en registros. Cada línea: "descripción" o "código | descripción | unidad | S"
// (separadores: | ; o tabulador; la última columna "S" marca que el material lleva número de serie).
function leerLineas(texto) {
  return String(texto || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((linea) => {
      const c = linea.split(/\s*[|;\t]\s*/).map((x) => x.trim());
      if (c.length === 1) return { descripcion: c[0] };
      if (c.length === 2) return { codigo: c[0], descripcion: c[1] };
      return {
        codigo: c[0], descripcion: c[1], unidad: c[2] || 'UND',
        con_serie: /^(s|si|sí|1|serie|true)$/i.test(c[3] || ''),
      };
    });
}

// Se ejecuta una sola vez (queda marcado en la base) para que los catálogos aparezcan ya cargados.
async function cargarCatalogosIniciales(pool) {
  await pool.query('CREATE TABLE IF NOT EXISTS catalogos_semilla (clave VARCHAR(40) NOT NULL PRIMARY KEY)');
  const [[hecho]] = await pool.query("SELECT COUNT(*) AS n FROM catalogos_semilla WHERE clave = 'v1'");
  if (hecho.n > 0) return;
  const mo = await fusionarCatalogo(pool, 'mano_obra_catalogo', MANO_OBRA);
  const mat = await fusionarCatalogo(pool, 'materiales', MATERIALES);
  await pool.query("INSERT INTO catalogos_semilla (clave) VALUES ('v1')");
  console.log(`Catálogos iniciales cargados: ${mo.agregados} de mano de obra, ${mat.agregados} materiales`);
}

module.exports = { MANO_OBRA, MATERIALES, fusionarCatalogo, leerLineas, cargarCatalogosIniciales };
