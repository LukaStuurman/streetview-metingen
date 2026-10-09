import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const require=createRequire(import.meta.url);
const builder=createRequire(require.resolve('electron-builder'));
const library=createRequire(builder.resolve('app-builder-lib'));
const asar=library('@electron/asar');
const file=process.argv[2];
if(!file)throw new Error('Geef het pad naar de gebouwde app.asar op.');
const paths=['desktop-google/app.mjs','desktop-google/aerial-map.mjs',
  'desktop-google/map-calibration.mjs','src/ahn.mjs'];
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
for(const path of paths){
  if(hash(asar.extractFile(file,path))!==hash(readFileSync(new URL('../'+path,import.meta.url))))
    throw new Error('Ingepakte bron verschilt: '+path);
}
const packaged=JSON.parse(asar.extractFile(file,'package.json'));
const source=JSON.parse(readFileSync(new URL('../package.json',import.meta.url)));
for(const key of ['name','version','main']){
  if(packaged[key]!==source[key])throw new Error('Ingepakte pakketgegevens verschillen: '+key);
}
console.log('Gebouwde versie en meet-/kalibratiebronnen komen overeen met de geteste bron.');
