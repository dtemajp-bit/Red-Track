// Reduce una foto antes de subirla (los celulares generan archivos de 4–10 MB y
// el servidor acepta máximo 8 MB). Si algo falla devuelve el archivo original.
export function comprimirFoto(archivo, maximo = 1600, calidad = 0.82) {
  return new Promise((resolve) => {
    if (!archivo || !archivo.type.startsWith('image/') || archivo.size < 400 * 1024) return resolve(archivo);
    const url = URL.createObjectURL(archivo);
    const img = new Image();
    img.onload = () => {
      const escala = Math.min(1, maximo / Math.max(img.width, img.height));
      const lienzo = document.createElement('canvas');
      lienzo.width = Math.round(img.width * escala);
      lienzo.height = Math.round(img.height * escala);
      lienzo.getContext('2d').drawImage(img, 0, 0, lienzo.width, lienzo.height);
      URL.revokeObjectURL(url);
      lienzo.toBlob(
        (blob) => {
          if (!blob || blob.size >= archivo.size) return resolve(archivo);
          const nombre = (archivo.name || 'foto').replace(/\.[^.]+$/, '') + '.jpg';
          resolve(new File([blob], nombre, { type: 'image/jpeg' }));
        },
        'image/jpeg',
        calidad
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(archivo);
    };
    img.src = url;
  });
}
