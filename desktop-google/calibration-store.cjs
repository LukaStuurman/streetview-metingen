"use strict";
const fs = require("node:fs");
const path = require("node:path");

function validCalibrationRecord(record) {
  return record && typeof record.key === "string" && record.key.length > 0 && record.key.length <= 250 &&
    Array.isArray(record.references) && record.references.length >= 1 && record.references.length <= 30 &&
    record.references.every(r => [r.rawX,r.rawY,r.x,r.y].every(Number.isFinite) &&
      [r.rawX,r.x].every(x => x>=-30000&&x<=330000) && [r.rawY,r.y].every(y => y>=280000&&y<=650000));
}

class CalibrationStore {
  constructor(file) { this.file=file; }
  load() {
    try {
      const data=JSON.parse(fs.readFileSync(this.file,"utf8"));
      if(data.version!==1||!Array.isArray(data.records))return [];
      return data.records.filter(validCalibrationRecord).slice(-200);
    } catch(error) { if(error.code==="ENOENT"||error instanceof SyntaxError)return []; throw error; }
  }
  save(record,key=record?.key) {
    if(typeof key!=="string"||key.length>250||(!record&& !key)||
      (record&&!validCalibrationRecord(record)))throw new Error("Ongeldige kaartkalibratie");
    const records=this.load().filter(r=>r.key!==key);
    if(record)records.push(record);
    fs.mkdirSync(path.dirname(this.file),{recursive:true});
    const temporary=`${this.file}.${process.pid}.tmp`;
    fs.writeFileSync(temporary,JSON.stringify({version:1,records:records.slice(-200)}),"utf8");
    fs.renameSync(temporary,this.file);
    return true;
  }
}
module.exports={CalibrationStore,validCalibrationRecord};
