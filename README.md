# PDF Catalog Price Annotator 🏷️📕

Una aplicación web interactiva y moderna para catalogar e insertar precios automáticamente en archivos PDF. Está diseñada específicamente para procesar catálogos de productos a partir de un listado de precios en Excel.

La aplicación detecta los códigos de tus productos en el PDF y posiciona los precios de forma interactiva justo al lado de cada código. Los usuarios pueden además editar o agregar precios de manera manual a través de un panel lateral y un buscador con autocompletado.

## Características

- **Detección Automática**: Mapeo inteligente entre códigos de Excel y textos del PDF usando `pdfjs-dist`.
- **Precios Interactivos**: Etiquetas flotantes sobre el visor PDF que se pueden editar directamente haciendo clic sobre ellas.
- **Buscador & Navegación**: Buscador integrado de códigos que desplaza suavemente la vista hasta la ubicación del producto en el catálogo.
- **Edición y Carga Manual**: Formulario para modificar o ingresar precios de productos que no estén en la base de datos de Excel o PDF.
- **Exportación en un Clic**: Generación y descarga de un nuevo PDF con los precios impresos permanentemente usando `pdf-lib`.
- **Despliegue Automatizado**: Listo para ser desplegado en GitHub Pages con flujo de trabajo de GitHub Actions incluido.

## Tecnologías Utilizadas

- **Vite** para desarrollo y construcción ágil.
- **SheetJS (xlsx)** para parsear el archivo de base de datos Excel.
- **PDF.js** para la extracción de texto y renderizado de páginas del catálogo.
- **pdf-lib** para la generación del PDF final modificado.
- **Vanilla CSS** con diseño premium en tema oscuro y efecto glassmorphism.

## Ejecución Local

Para ejecutar el proyecto en tu máquina local:

1. Instala las dependencias:
   ```bash
   npm install
   ```

2. Inicia el servidor de desarrollo:
   ```bash
   npm run dev
   ```

3. Abre el navegador en la dirección que indique la terminal (usualmente `http://localhost:5173`).

## Estructura de Datos Recomendada para el Excel

La aplicación buscará de manera inteligente columnas que identifiquen los códigos y precios. Para un funcionamiento óptimo, asegúrate de que tu archivo de Excel tenga encabezados claros, tales como:

- **Códigos**: `Código`, `Codigo`, `Code`, `Cod`, `Referencia` o `Ref`.
- **Precios**: `Precio`, `Price`, `Valor`, `Costo` o `PVP`.

## Despliegue en GitHub Pages

El proyecto incluye un flujo de trabajo de GitHub Actions en `.github/workflows/deploy.yml` que facilita el despliegue automático.

Para desplegarlo en tu repositorio de GitHub:

1. Crea un repositorio en tu cuenta de GitHub (ej: `pdf-price`).
2. Sube el código local a tu repositorio:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/TU_REPOSITORIO.git
   git push -u origin main
   ```
3. En la configuración de tu repositorio de GitHub (**Settings > Pages**):
   - En la sección **Build and deployment > Source**, selecciona **GitHub Actions**.
4. ¡Listo! La acción compilará y publicará la aplicación automáticamente en `https://TU_USUARIO.github.io/TU_REPOSITORIO/`.
