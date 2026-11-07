// FairReview Hardhat 2 설정
// - 체인: 로컬 hardhat(31337) · localhost 만. Sepolia 는 8단계에서 추가, 메인넷은 만들지 않는다.
// - 컴파일러: npm 의 solc@0.8.24(solcjs)를 그대로 써서, 컴파일러 다운로드가 막힌 환경에서도 동작한다.
require("@nomicfoundation/hardhat-chai-matchers"); // hardhat-ethers 도 함께 불러온다
require("@nomicfoundation/hardhat-network-helpers");
require("dotenv").config(); // 8단계 Sepolia 용 값은 .env 에만 둔다 (지금은 읽는 값 없음)

const path = require("path");
const { subtask } = require("hardhat/config");
const { TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD } = require("hardhat/builtin-tasks/task-names");

const SOLC_VERSION = "0.8.24";

// 컴파일러를 인터넷에서 받지 않고 node_modules/solc 를 쓰게 바꾼다
subtask(TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD, async (args, hre, runSuper) => {
  if (args.solcVersion !== SOLC_VERSION) return runSuper();

  const solcPkg = require("solc/package.json");
  if (solcPkg.version !== SOLC_VERSION) {
    throw new Error(`npm solc 버전이 ${solcPkg.version} 입니다. ${SOLC_VERSION} 로 설치하세요.`);
  }
  const solc = require("solc");
  return {
    compilerPath: path.join(path.dirname(require.resolve("solc/package.json")), "soljson.js"),
    isSolcJs: true,
    version: SOLC_VERSION,
    longVersion: solc.version(),
  };
});

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: SOLC_VERSION,
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "paris",
    },
  },
  defaultNetwork: "hardhat",
  networks: {
    hardhat: { chainId: 31337 },
    localhost: { url: "http://127.0.0.1:8545", chainId: 31337 },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};
