MVP

TECNOLOGÍAS: Nextjs,Typescript, Tailwindcss,

USUARIO ADJUNTA UN LIBRO A LA PÁGINA: Buscándolo en file explorer o con drag and drop.

1. El idioma original del documento y el idioma target se eligen de una lista

Admite archivos pdf

La app divide el archivo en frases e intercala las frases del idioma original con su traducción. De esta manera, el usuario puede aprender idiomas como lo haría en Easy German o Lingopie.

1. Cuando se clica traducir:
2. Se traduce el libro añadiendo al idioma original una traducción al idioma target intercalado
3. Traducimos con rest api en cliente con un worker, como se puede ver aquí

Cuando se le da a traducir, muestra cuantas frases quedan por traducir y su porcentaje sobre el total

Al final, el usuario puede descargar como PDF su libro

# Con más features

TECNOLOGÍAS: Nextjs, Typescript, Tailwindcss, rest api

1. El idioma original del documento se detecta, aunque si se la detección es errónea se puede cambiar en una lista
2. El idioma target se elige de una lista

USUARIO ADJUNTA UN DOCUMENTO A LA PÁGINA: Buscándolo en file explorer o con drag and drop.

Admite archivos pdf, epub,mobi,txt.

1. Cuando se clica traducir:
2. Traducimos documentos, generalmente libros añadiendo al idioma original una traducción al idioma target intercalado
3. Traducimos con rest api

Con un worker al que llamamos cuando el usuario clica traducir.

De momento descartamos tener un servidor como fallback.

La app divide el archivo en frases e intercala las frases del idioma original con su traducción. De esta manera, el usuario puede aprender idiomas como lo haría en Easy German o Lingopie.

1. También se le puede añadir transcripción fonética. Pasamos el idioma original a IPA → De IPA al idioma target. Por ejemplo, si en original “You are here” →IPA →”Yu ar jiar” en español, usando IPA como puente

También queremos que se pueda leer en voz alta con programas como acrobat. Pero solo el texto original, e ignore la traducción o la pronunciación intercaladas.

Se tiene que conservar la portada(primera página) original del libro.

Cuando se le da a traducir, transformers muestra en tiempo real como se va formando el libro. También un progreso de cuantas frases quedan por traducir y su porcentaje sobre el total

También se puede elegir si se quiere traducir el libro entero, o de una página a otra página

Al final, el usuario puede descargar como PDF, epub, mobi,html para poder leer su libro intercalado
