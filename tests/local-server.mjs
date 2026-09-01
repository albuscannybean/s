import http from 'node:http';
import {createReadStream,statSync} from 'node:fs';
import {extname,join,normalize} from 'node:path';

const root=process.cwd(),port=Number(process.argv[2]??4174),mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json; charset=utf-8','.svg':'image/svg+xml'};
http.createServer((request,response)=>{try{const pathname=decodeURIComponent(new URL(request.url,'http://localhost').pathname),relative=normalize(pathname).replace(/^[/\\]+/,'');let file=join(root,relative);if(!file.startsWith(root)){response.writeHead(403);response.end('Forbidden');return}if(statSync(file).isDirectory())file=join(file,'index.html');response.writeHead(200,{'content-type':mime[extname(file)]??'application/octet-stream','cache-control':'no-store'});createReadStream(file).pipe(response)}catch{response.writeHead(404);response.end('Not found')}}).listen(port,'127.0.0.1',()=>console.log(`LMN local QA server: http://127.0.0.1:${port}`));
