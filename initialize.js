import 'dotenv/config';
import { mkdirSync, readdirSync, statSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

console.log("###################### Initializing ########################");

// Get dirname (equivalent to the Bash version)
const __filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(__filename);

// variable for later setting pinned version of soroban in "$(dirname/target/bin/soroban)"
const soroban = "soroban"

// Function to execute and log shell commands
function exe(command) {
  console.log(command);
  execSync(command, { stdio: 'inherit' });
}

function fund_all() {
  // will also fund the account since .env sets SOROBAN_NETWORK_PASSPHRASE && SOROBAN_RPC_URL
  exe(`${soroban} keys generate ${process.env.SOROBAN_ACCOUNT}`);
}

function build_all() {
  exe(`rm ${dirname}/target/wasm32-unknown-unknown/release/*.wasm`);
  exe(`rm ${dirname}/target/wasm32-unknown-unknown/release/*.d`);
  exe(`${soroban} contract build`);
}

function filenameNoExtension(filename) {
  return path.basename(filename, path.extname(filename));
}

function deploy(wasm) {
  exe(`(${soroban} contract deploy --wasm ${wasm} --ignore-checks) > ${dirname}/.soroban/contract-ids/${filenameNoExtension(wasm)}.txt`);
}

function deploy_all() {
  const contractsDir = `${dirname}/.soroban/contract-ids`;
  mkdirSync(contractsDir, { recursive: true });

  const wasmFiles = readdirSync(`${dirname}/target/wasm32-unknown-unknown/release`).filter(file => file.endsWith('.wasm'));
  
  wasmFiles.forEach(wasmFile => {
    deploy(`${dirname}/target/wasm32-unknown-unknown/release/${wasmFile}`);
  });
}

function bind(contract) {
  const filenameNoExt = filenameNoExtension(contract);
  exe(`${soroban} contract bindings typescript --contract-id $(cat ${contract}) --output-dir ${dirname}/packages/${filenameNoExt} --overwrite`);
}

function bind_all() {
  const contractIdsDir = `${dirname}/.soroban/contract-ids`;
  const contractFiles = readdirSync(contractIdsDir);

  contractFiles.forEach(contractFile => {
    const contractPath = path.join(contractIdsDir, contractFile);
    if (statSync(contractPath).size > 0) {  // Check if file is not empty
      bind(contractPath);
    }
  });
}

function importContract(contract) {
  const filenameNoExt = filenameNoExtension(contract);
  const outputPath = `${dirname}/src/contracts/${filenameNoExt}.ts`;
  const importContent = `import * as Client from '${filenameNoExt}';\n` +
                        `import { rpcUrl } from './util';\n\n` +
                        `export default new Client.Contract({\n` +
                        `  ...Client.networks.standalone,\n` +
                        `  rpcUrl,\n` +
                        `});\n`;
  
  writeFileSync(outputPath, importContent);
  console.log(`Created import for ${filenameNoExt}`);
}

function import_all() {
  const contractIdsDir = `${dirname}/.soroban/contract-ids`;
  const contractFiles = readdirSync(contractIdsDir);

  contractFiles.forEach(contractFile => {
    const contractPath = path.join(contractIdsDir, contractFile);
    if (statSync(contractPath).size > 0) {  // Check if file is not empty
      importContract(contractPath);
    }
  });
}

exe('echo $SOROBAN_ACCOUNT $SOROBAN_NETWORK_PASSPHRASE $SOROBAN_RPC_URL');

// Calling the functions (equivalent to the last part of your bash script)
fund_all();
build_all();
deploy_all();
bind_all();
import_all();
