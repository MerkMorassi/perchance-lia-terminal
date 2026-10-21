import { voxconEngine } from '../src/services/voxconpack/voxconEngine';
const res = voxconEngine.normalize('switch commpack to OPERATIONAL');
console.log(JSON.stringify(res, null, 2));
