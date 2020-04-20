const fs = require('fs')
const axios = require('axios').default;

const express = require("express");
const app = express();
const bodyParser = require('body-parser');

let baseURL = 'http://hipermedial.surwww.com/2020/';

app.use(bodyParser.urlencoded({ extended: false }));

let pages = [];
const commonTags = [ 'html', 'head', 'meta', 'link', 'title', 'body' ];
const basicRequiredTags = [ 'h1', 'p', 'em', 'strong', 'img', 'a', 'ul', 'li' ];

addPage = (page, fromURL, res) => {
    let url = new URL(page, fromURL);
    if(!pages.find(page => page.href === url.href)) {
        let currentPage = pages.length;
        pages.push({ href: url.href, tags: [], content: '', parsed: false, validation: null, links: [] });

        // Page load
        console.log("Cargando página:", page, "...");
        axios
        .get(pages[currentPage].href)
        .then(response => {
            pages[currentPage].content = response.data;
            pages[currentPage].tags = getTags(pages[currentPage].content);
            pages[currentPage].links = getLinks(pages[currentPage].content);

            // Validation
            axios
            .get('https://validator.w3.org/nu/?out=json&doc=' + encodeURIComponent(pages[currentPage].href))
            .then(response => {
                pages[currentPage].validation = response.data;
                pages[currentPage].parsed = true;
                pages[currentPage].validationErrors = 0;
                pages[currentPage].validationWarnings = 0;


                if ( response.data["messages"] ) {
                  for ( let m of response.data["messages"] ) {
                    if ( m.type == "info" ) {
                      pages[currentPage].validationWarnings += 1;
                    }
                    if ( m.type == "error" ) {
                      pages[currentPage].validationErrors += 1;
                    }
                  }
                }

                // Navigate to internal links
                for(let i = 0; i < pages[currentPage].links.length; i++) {
                    addPage(pages[currentPage].links[i], pages[currentPage].href, res);
                }

                let strFinal = done()
                if ( strFinal ) {
                    res.end(strFinal);
                }
            });
        })
        .catch(e => {
            console.log("catched")
            pages[currentPage].parsed = true;
            res.end(done());
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
  // let re = /<a.+?href *?= *?["']((?!(http:\/\/|https:\/\/)).+?(\/|.html|.htm))["']/ig;
  let re = /<a.+?href *?= *?["'](.+?(\/|.html|.htm))["']/ig;
  let links = [];
  let match;
  while ((match = re.exec(page)) != null) {
    if(!match[1].startsWith('http://') && !match[1].startsWith('https://')) {
      links.push(match[1]);
    } else if(match[1].startsWith(baseURL)) {
      links.push(match[1]);
    }
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
    let fileName = getFileName(pages[0].href);
    let author = fileName.replace('_', ' ');
    let tags = [...getAllTags()];
    let unusedTags = basicRequiredTags.filter(tag => tags.indexOf(tag) === -1);
    let additionalTags = tags.filter(tag => basicRequiredTags.indexOf(tag) === -1);
    let date = new Date();
    let errorCount = pages.reduce((a, v) => { return (v.validation && v.validation.messages.length > 0) ? a + 1 : a; }, 0);
    let notFoundCount = pages.reduce((a, v) => { return (v.content === '') ? a + 1 : a; }, 0);
    let pageDetails = pages.map(page => {
      return (page.content === '') ? `<section style="padding-bottom: 1em; border-bottom: 1px dashed #222; margin-bottom: 2em;">
      <h3 style="font-weight: normal; margin: 0;">404 (${page.href.replace(baseURL, '')})</h3>
      <dl>
        <dt style="float: left; margin-right: 0.25em; color: #069;">Nombres de archivos y carpetas adecuado:</dt>
        <dd>${page.href === page.href.replace(/[^a-z0-9-_\/\.:]/g, "").toLowerCase() ? 'Sí' : 'No'}</dd>
        <dt style="float: left; margin-right: 0.25em; color: #069;">URL:</dt>
        <dd><a href="${page.href}" target="_blank">${page.href}</a></dd>
      </dl>
    </section>` : `<section style="padding-bottom: 1em; border-bottom: 1px dashed #222; margin-bottom: 2em;">
        <h3 style="font-weight: normal; margin: 0;">${getTitle(page.content)} (${page.href.replace(baseURL, '')})</h3>
        <dl>
          <dt style="float: left; margin-right: 0.25em; color: #069;">Valida correctamente:</dt>
          <dd>
            <a href="https://validator.w3.org/nu/?doc=${encodeURIComponent(page.href)}" target="_blank">${page.validation.messages.length === 0 ? 'Sí' : 'No'}</a>
            (${page.validationErrors} errores, ${page.validationWarnings} advertencias)
          </dd>
          <dt style="float: left; margin-right: 0.25em; color: #069;">Etiquetas utilizadas:</dt>
          <dd>${filterTags(page.tags).join(', ')}</dd>
          <dt style="float: left; margin-right: 0.25em; color: #069;">Páginas linkeadas:</dt>
          <dd>${page.links.join(', ')}</dd>
          <dt style="float: left; margin-right: 0.25em; color: #069;">Nombres de archivos y carpetas adecuado:</dt>
          <dd>${page.href === page.href.replace(/[^a-z0-9-_\/\.:]/g, "").toLowerCase() ? 'Sí' : 'No'}</dd>
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
            <dt style="float: left; margin-right: 0.25em; color: #069;">Páginas no encontradas:</dt>
            <dd>${notFoundCount}</dd>
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

    console.log("Hecho.");
    return contentHTML;
    } else {
        return null
    }
}

app.get("/", (req,res) => {
    let finalUrl = null;
    let finalPage = "index.html"
    pages = [];

    if ( req.query.url ) {
        finalUrl = req.query.url

        if ( finalUrl.endsWith("html") ) {
            finalPage = finalUrl.substr( finalUrl.lastIndexOf("/") + 1 )
            finalUrl = finalUrl.substr( 0, finalUrl.lastIndexOf("/") )
        }

        if ( !finalUrl.startsWith("http") ) {
            if ( finalUrl.startsWith("/") ) {
                finalUrl = finalUrl.substr(1)
            }

            finalUrl = baseURL + finalUrl
        }

        if ( !finalUrl.endsWith("/") ) {
            finalUrl += "/"
        }
    }

    baseURL = finalUrl;
    //console.log( finalUrl )

    addPage(finalPage, finalUrl, res)
})

const server = app.listen(8081, function () {
    let port = server.address().port
    console.log(`Escuchando localhost:${port}.`)
    console.log("\nEjemplos de uso:")
    console.log(`localhost:${port}/?url=garber_leandro/tp0`)
    console.log(`localhost:${port}/?url=/garber_leandro/tp0`)
    console.log(`localhost:${port}/?url=garber_leandro/tp0/index.html`)
    console.log(`localhost:${port}/?url=http://hipermedial.surwww.com/2020/garber_leandro/tp0 (es lo mismo) \n\n`)
})


// if ( process.argv.length < 3 ) {
//     const readline = require("readline");
//     const rl = readline.createInterface({
//         input: process.stdin,
//         output: process.stdout
//     });
//
//     rl.question("Ingrese la URL principal: ", url => {
//         rl.question("Ingrese el nombre del archivo index: ", index => {
//             baseURL = url;
//             addPage(index, url);
//             rl.close();
//         });
//     });
// } else {
//     let url = process.argv[2]
//     let index = process.argv[3]
//
//     baseURL = url;
//     addPage( index, url )
// }
