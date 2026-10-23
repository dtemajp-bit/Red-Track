import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import EncabezadoPantalla from '../components/EncabezadoPantalla';
import { colores } from '../theme/colors';
import cliente from '../api/cliente';
import { useAuth } from '../context/AuthContext';
import { obtenerCola, quitarDeCola, enviarRegistro } from '../offline/cola';

const ETIQUETA_TIPO = {
  nodo: 'Infraestructura',
  cable: 'Cable',
  incidencia: 'Incidencia',
};

function resumenLocal(r) {
  if (r.tipo === 'nodo') return `${r.datos.codigo || 'Sin código'} · ${r.datos.tipo}`;
  return String(r.datos.descripcion || '').slice(0, 60);
}

export default function SincronizacionScreen() {
  const { usuario } = useAuth();
  // Registros guardados en este teléfono por falta de señal.
  const [locales, setLocales] = useState([]);
  // Registros pendientes guardados en el servidor (tabla registros_pendientes_sync).
  const [pendientes, setPendientes] = useState([]);
  // Últimos registros que ya llegaron al servidor (en línea o enviados tras quedar sin señal).
  const [historial, setHistorial] = useState([]);
  const [erroresLocales, setErroresLocales] = useState({}); // idLocal -> mensaje
  const [cargando, setCargando] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [confirmados, setConfirmados] = useState(null);
  const [sinConexion, setSinConexion] = useState(false);
  const [error, setError] = useState('');

  const cargarTodo = useCallback(async () => {
    setError('');
    setLocales(await obtenerCola(usuario.id_usuario));
    try {
      const respuesta = await cliente.get('/sincronizacion/pendientes');
      setPendientes(respuesta.data);
      setSinConexion(false);
      try {
        const hist = await cliente.get('/sincronizacion/historial?limite=15');
        setHistorial(hist.data);
      } catch {
        /* el historial es informativo: si falla no se muestra error */
      }
    } catch (e) {
      if (e.response === null) setSinConexion(true);
      else setError('No se pudieron cargar los registros pendientes del servidor.');
    }
  }, [usuario.id_usuario]);

  useEffect(() => {
    (async () => {
      setCargando(true);
      await cargarTodo();
      setCargando(false);
    })();
  }, [cargarTodo]);

  async function descartarLocal(idLocal) {
    await quitarDeCola(idLocal);
    setErroresLocales((prev) => {
      const copia = { ...prev };
      delete copia[idLocal];
      return copia;
    });
    setLocales(await obtenerCola(usuario.id_usuario));
  }

  async function sincronizar() {
    setSincronizando(true);
    setConfirmados(null);
    setSinConexion(false);
    const nuevosErrores = {};
    let exitosos = 0;
    let sinRed = false;

    // 1) Registros guardados en el teléfono: se envían al servidor.
    for (const r of locales) {
      try {
        await enviarRegistro(r);
        await quitarDeCola(r.idLocal);
        exitosos += 1;
      } catch (e) {
        if (e.response === null) {
          sinRed = true;
          break; // sin señal: no tiene caso seguir intentando
        }
        // El servidor rechazó el registro (ej. código duplicado): se muestra el motivo.
        nuevosErrores[r.idLocal] = e.response?.data?.mensaje || 'El servidor rechazó este registro';
      }
    }

    // 2) Registros pendientes que ya estaban en el servidor.
    if (!sinRed) {
      for (const p of pendientes) {
        try {
          await cliente.put(`/sincronizacion/${p.id_registro}/sincronizar`);
          exitosos += 1;
        } catch (e) {
          if (e.response === null) {
            sinRed = true;
            break;
          }
        }
      }
    }

    setErroresLocales(nuevosErrores);
    setSinConexion(sinRed);
    setConfirmados(exitosos);
    setSincronizando(false);
    await cargarTodo();
  }

  const total = locales.length + pendientes.length;

  return (
    <ScrollView style={styles.contenedor} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <EncabezadoPantalla titulo="Sincronización" />

      <View style={styles.tarjeta}>
        <View style={[styles.estado, { backgroundColor: sinConexion ? '#fbeee0' : '#e3f7ec' }]}>
          <Text style={[styles.estadoTitulo, { color: sinConexion ? colores.orange : colores.text }]}>
            {sinConexion ? 'Sin conexión' : 'Listo para sincronizar'}
          </Text>
          <Text style={[styles.estadoTexto, { color: sinConexion ? colores.orange : colores.textMuted }]}>
            {sinConexion
              ? 'No hay señal con el servidor. Tus registros siguen guardados en este teléfono; vuelve a intentarlo cuando recuperes conexión.'
              : 'Si registraste algo sin señal, quedó guardado en este teléfono. Toca Sincronizar para enviarlo.'}
          </Text>
        </View>

        {error ? <Text style={styles.textoError}>{error}</Text> : null}

        {cargando ? (
          <ActivityIndicator color={colores.navy} style={{ marginVertical: 14 }} />
        ) : (
          <>
            {locales.length > 0 ? <Text style={styles.seccion}>GUARDADOS EN ESTE TELÉFONO</Text> : null}
            {locales.map((r) => (
              <View key={r.idLocal} style={styles.filaLista}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.codigoLista}>{ETIQUETA_TIPO[r.tipo] || r.tipo}</Text>
                  <Text style={styles.detalleLista}>{resumenLocal(r)}</Text>
                  {erroresLocales[r.idLocal] ? (
                    <>
                      <Text style={styles.errorItem}>{erroresLocales[r.idLocal]}</Text>
                      <TouchableOpacity onPress={() => descartarLocal(r.idLocal)}>
                        <Text style={styles.descartar}>Descartar este registro</Text>
                      </TouchableOpacity>
                    </>
                  ) : null}
                </View>
                <Text style={styles.hora}>
                  {new Date(r.creadoEn).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            ))}

            {pendientes.length > 0 ? <Text style={styles.seccion}>PENDIENTES EN EL SERVIDOR</Text> : null}
            {pendientes.map((p) => (
              <View key={p.id_registro} style={styles.filaLista}>
                <View>
                  <Text style={styles.codigoLista}>{ETIQUETA_TIPO[p.tipo_entidad] || p.tipo_entidad}</Text>
                  <Text style={styles.detalleLista}>Registro #{p.id_registro}</Text>
                </View>
                <Text style={styles.hora}>
                  {new Date(p.creado_en).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            ))}

            {total === 0 && confirmados !== null ? (
              <Text style={styles.confirmado}>✓ {confirmados} registros sincronizados correctamente.</Text>
            ) : null}
            {total === 0 && confirmados === null ? (
              <Text style={styles.detalleLista}>No tienes registros pendientes.</Text>
            ) : null}
          </>
        )}

        {!cargando && historial.length > 0 ? (
          <>
            <Text style={[styles.seccion, { marginTop: 18 }]}>ACTIVIDAD RECIENTE EN EL SERVIDOR</Text>
            {historial.map((h) => (
              <View key={`${h.tipo}-${h.id}`} style={styles.filaLista}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.codigoLista}>
                    {ETIQUETA_TIPO[h.tipo] || h.tipo} · {h.detalle}
                  </Text>
                  <Text style={styles.detalleLista}>
                    {h.origen === 'sin_conexion' ? 'Enviado tras quedar sin señal' : 'Enviado en línea'}
                  </Text>
                </View>
                <Text style={styles.hora}>
                  {new Date(h.sincronizado_en).toLocaleString('es-GT', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
            ))}
          </>
        ) : null}

        <View style={styles.pieFila}>
          <Text style={styles.textoMuted}>{total} registros pendientes</Text>
          <TouchableOpacity
            onPress={sincronizar}
            disabled={sincronizando || total === 0}
            style={[styles.boton, total === 0 && styles.botonDeshabilitado]}
          >
            {sincronizando ? (
              <ActivityIndicator color={colores.white} />
            ) : (
              <Text style={styles.botonTexto}>↻ Sincronizar</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  seccion: { fontSize: 12.5, fontWeight: '700', color: colores.textMuted, marginTop: 10, marginBottom: 4 },
  errorItem: { color: colores.red, fontSize: 12, marginTop: 2 },
  descartar: { color: colores.red, fontSize: 12.5, fontWeight: '600', marginTop: 4 },
  textoError: { color: colores.red, fontSize: 12.5, marginBottom: 8 },
  contenedor: { flex: 1, backgroundColor: colores.bg },
  tarjeta: {
    backgroundColor: colores.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colores.border,
    padding: 16,
  },
  estado: { borderRadius: 8, padding: 13, marginBottom: 16 },
  estadoTitulo: { fontWeight: '700', fontSize: 13.7, marginBottom: 3 },
  estadoTexto: { fontSize: 12.5 },
  filaLista: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colores.border,
  },
  codigoLista: { fontSize: 13.7, fontWeight: '600', color: colores.text },
  detalleLista: { fontSize: 12.3, color: colores.textMuted, marginTop: 2 },
  hora: { fontSize: 12.3, color: colores.textMuted },
  confirmado: { color: '#17a35a', fontSize: 13.7, paddingVertical: 10 },
  pieFila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
  },
  textoMuted: { fontSize: 13, color: colores.textMuted },
  boton: { backgroundColor: colores.navy, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 18 },
  botonDeshabilitado: { backgroundColor: '#c7ccd6' },
  botonTexto: { color: colores.white, fontWeight: '700', fontSize: 13.5 },
});
