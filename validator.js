const fs = require('fs')
const axios = require('axios').default;

const BASE_URL = 'http://hipermedial.surwww.com/2020/garber_leandro/tp0/';
const INDEX = "index.html";

const pages = [];
const commonTags = [ 'html', 'head', 'meta', 'link', 'title', 'body' ];
const basicRequiredTags = [ 'h1', 'p', 'em', 'strong', 'img', 'a', 'ul', 'li' ];

addPage = (page, baseURL) => {
  let url = new URL(page, baseURL);
  if(!pages.find(page => page.href === url.href)) {
    console.log(url)
    let currentPage = pages.length;
    pages.push({ href: url.href, tags: [], content: '', parsed: false, validation: null, links: [] });
    
    // Page load
    console.log("Cargando página:", page, "...");
    axios.get(pages[currentPage].href).then(response => {
      pages[currentPage].content = response.data;
      pages[currentPage].tags = getTags(pages[currentPage].content);
      pages[currentPage].links = getLinks(pages[currentPage].content);
      
      // Validation
      axios.get('https://validator.w3.org/nu/?out=json&doc=' + encodeURIComponent(pages[currentPage].href)).then(response => {
        pages[currentPage].validation = response.data;
        pages[currentPage].parsed = true;
        
        // Navigate to internal links
        for(let i = 0; i < pages[currentPage].links.length; i++) {
          addPage(pages[currentPage].links[i], pages[currentPage].href);
        }
        done();

      });
    })

  }
}

getTags = (page) => {
  let re = /<(\w+?)[ >]/ig;
  let result = page.match(re);
  if(result) {
    result = result.map(tag => {
      return tag.substr(1, tag.length-2);
    });
    let uniqueTags = new Set(result);
    return [...uniqueTags];
  }
  return [];
}

getLinks = (page) => {
  let re = /<a.+?href=["']((?!(http:\/\/|https:\/\/)).+?(\/|.html|.htm))["']/ig;
  let links = [];
  let match;
  while ((match = re.exec(page)) != null) {
    links.push(match[1]);
  }
  return links;
}

getTitle = (page) => {
  let re = /<title>(.*?)<\/title>/ig;
  if ((match = re.exec(page)) != null) {
    return match[1];
  }
  return null;
}

getFileName = (url) => {
  let re = /\/2020\/(.*?)\//ig;
  if ((match = re.exec(url)) != null) {
    return match[1];
  }
  return null;
}

filterTags = (tags) => {
  return tags.filter(tag => commonTags.indexOf(tag) === -1)
}

getAllTags = () => {
  let tags = pages.reduce((accumulator, page) => {
    return accumulator.concat(page.tags);
  }, []);
  return new Set(filterTags(tags));
}

done = () => {
  if(!pages.find(page => !page.parsed)) {
    console.log("Paginas analizadas.");
    let title = getTitle(pages[0].content);
    let fileName = getFileName(BASE_URL);
    let author = fileName.replace('_', ' ');
    let tags = [...getAllTags()];
    let unusedTags = basicRequiredTags.filter(tag => tags.indexOf(tag) === -1);
    let additionalTags = tags.filter(tag => basicRequiredTags.indexOf(tag) === -1);
    let date = new Date();
    let errorCount = pages.reduce((a, v) => { return (v.validation.messages.length > 0) ? a + 1 : a; }, 0);
    let pageDetails = pages.map(page => {
      return `<section style="padding-bottom: 1em; border-bottom: 1px dashed #222; margin-bottom: 2em;">
        <h3 style="font-weight: normal; margin: 0;">${getTitle(page.content)} (${page.href.replace(BASE_URL, '')})</h3>
        <dl>
          <dt style="float: left; margin-right: 0.25em; color: #069;">Valida correctamente:</dt>
          <dd><a href="https://validator.w3.org/nu/?doc=${encodeURIComponent(page.href)}" target="_blank">${page.validation.messages.length === 0 ? 'Sí' : 'No'}</a></dd>
          <dt style="float: left; margin-right: 0.25em; color: #069;">Etiquetas utilizadas:</dt>
          <dd>${filterTags(page.tags).join(', ')}</dd>
          <dt style="float: left; margin-right: 0.25em; color: #069;">Páginas linkeadas:</dt>
          <dd>${page.links.join(', ')}</dd>
          <dt style="float: left; margin-right: 0.25em; color: #069;">URL:</dt>
          <dd><a href="${page.href}" target="_blank">${page.href}</a></dd>
        </dl>
      </section>`;
    })
    let contentHTML = `<!DOCTYPE html>
    <html lang="es" dir="ltr">
      <head>
        <meta charset="utf-8">
        <title>${author.toUpperCase() + ': ' + title}</title>
      </head>
      <body>
        <article style="line-height: 1.625; max-width: 680px; margin: 0 auto; color: #222;">
          <h1 style="text-transform: capitalize; font-size: 2em;">${author}</h1>
          <dl>
            <dt style="float: left; margin-right: 0.25em; color: #069;">Título:</dt>
            <dd>${title}</dd>
            <dt style="float: left; margin-right: 0.25em; color: #069;">Total de páginas:</dt>
            <dd>${pages.length}</dd>
            <dt style="float: left; margin-right: 0.25em; color: #069;">Páginas con errores de validación:</dt>
            <dd>${errorCount}</dd>
            <dt style="float: left; margin-right: 0.25em; color: #069;">Cantidad de etiquetas utilizadas:</dt>
            <dd>${tags.length}</dd>
            <dt style="float: left; margin-right: 0.25em; color: #069;">Etiquetas:</dt>
            <dd>${tags.join(', ')}</dd>
            <dt style="float: left; margin-right: 0.25em; color: #069;">Utiliza todas las etiquetas de la primera lista:</dt>
            <dd>${unusedTags.length === 0 ? 'Sí' : 'No'}</dd>
            ${unusedTags.length > 0 ? `<dt style="float: left; margin-right: 0.25em; color: #069;">Etiquetas de la primera lista faltantes:</dt>
            <dd>${unusedTags.join(', ')}</dd>` : ''}
            <dt style="float: left; margin-right: 0.25em; color: #069;">Etiquetas de otras listas:</dt>
            <dd>${additionalTags.join(', ')}</dd>
            <dt style="float: left; margin-right: 0.25em; color: #069;">Fecha del reporte:</dt>
            <dd>${date.getDate()}/${date.getMonth()+1}/${date.getFullYear()}</dd>
          </dl>
          <h2>Páginas</h2>
          ${pageDetails.join('')}
        </article>
      </body>
    </html>`;
    console.log("Creando reporte:", fileName + '.html', "...");
    let dir = './reportes'
    if (!fs.existsSync(dir)){
      fs.mkdirSync(dir)
    }
    fs.writeFileSync(dir + '/' + fileName + '.html', contentHTML);
    console.log("Hecho.");
  }
}

addPage(INDEX, BASE_URL);