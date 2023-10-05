import { LockDealProvider } from '../typechain-types';
import { TimedDealProvider } from '../typechain-types';
import { LockDealNFT } from '../typechain-types';
import { DealProvider } from '../typechain-types';
import { MockProvider } from '../typechain-types';
import { MockVaultManager } from '../typechain-types';
import { DelayVaultProvider } from '../typechain-types';
import { IDelayVaultData } from '../typechain-types/contracts/AdvancedProviders/DelayVaultProvider/DelayVaultProvider';
import { deployed, token, MAX_RATIO, _createUsers } from './helper';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';

describe('DelayVault Provider', function () {
  let timedDealProvider: TimedDealProvider;
  let lockProvider: LockDealProvider;
  let dealProvider: DealProvider;
  let lockDealNFT: LockDealNFT;
  let mockProvider: MockProvider;
  let mockVaultManager: MockVaultManager;
  let delayVaultProvider: DelayVaultProvider;
  let poolId: BigNumber;
  let vaultId: BigNumber;
  let receiver: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let user3: SignerWithAddress;
  let user4: SignerWithAddress;
  let newOwner: SignerWithAddress;
  let startTime: number, finishTime: number;
  let providerData: IDelayVaultData.ProviderDataStruct[];
  const tier1 = ethers.BigNumber.from(250);
  const tier2 = ethers.BigNumber.from(3500);
  const tier3 = ethers.BigNumber.from(20000);
  const ratio = MAX_RATIO.div(2); // half of the amount
  const gasLimit = 130_000_000;

  before(async () => {
    [receiver, newOwner, user1, user2, user3, user4] = await ethers.getSigners();
    mockVaultManager = await deployed('MockVaultManager');
    lockDealNFT = await deployed('LockDealNFT', mockVaultManager.address, '');
    dealProvider = await deployed('DealProvider', lockDealNFT.address);
    lockProvider = await deployed('LockDealProvider', lockDealNFT.address, dealProvider.address);
    timedDealProvider = await deployed('TimedDealProvider', lockDealNFT.address, lockProvider.address);
    mockProvider = await deployed('MockProvider', lockDealNFT.address, timedDealProvider.address);
    const DelayVaultProvider = await ethers.getContractFactory('DelayVaultProvider');
    const ONE_DAY = 86400;
    const week = ONE_DAY * 7;
    startTime = week;
    finishTime = week * 4;
    providerData = [
      { provider: dealProvider.address, params: [], limit: tier1 },
      { provider: lockProvider.address, params: [startTime], limit: tier2 },
      { provider: timedDealProvider.address, params: [startTime, finishTime], limit: tier3 },
    ];
    delayVaultProvider = await DelayVaultProvider.deploy(token, lockDealNFT.address, providerData, {
      gasLimit: gasLimit,
    });
    await lockDealNFT.setApprovedContract(dealProvider.address, true);
    await lockDealNFT.setApprovedContract(lockProvider.address, true);
    await lockDealNFT.setApprovedContract(timedDealProvider.address, true);
    await lockDealNFT.setApprovedContract(mockProvider.address, true);
    await lockDealNFT.setApprovedContract(delayVaultProvider.address, true);
  });

  beforeEach(async () => {
    poolId = await lockDealNFT.totalSupply();
  });

  it('should check provider name', async () => {
    expect(await delayVaultProvider.name()).to.equal('DelayVaultProvider');
  });

  it("should check provider's token", async () => {
    expect(await delayVaultProvider.token()).to.equal(token);
  });

  it("should check provider's lockDealNFT", async () => {
    expect(await delayVaultProvider.lockDealNFT()).to.equal(lockDealNFT.address);
  });

  it('should check _finilize constructor data', async () => {
    for (let i = 0; i < providerData.length; i++) {
      const data = await delayVaultProvider.getTypeToProviderData(i);
      expect(data.provider).to.equal(providerData[i].provider);
      expect(data.params).to.deep.equal(providerData[i].params);
      i != providerData.length - 1
        ? expect(data.limit).to.equal(providerData[i].limit)
        : expect(data.limit).to.equal(ethers.constants.MaxUint256);
    }
  });

  it('should return new provider poolId', async () => {
    const params = [tier1];
    const lastPoolId = (await lockDealNFT.totalSupply()).sub(1);
    await delayVaultProvider.createNewDelayVault(receiver.address, params);
    expect((await lockDealNFT.totalSupply()).sub(1)).to.equal(lastPoolId.add(1));
  });

  it('should check vault data with tier 1', async () => {
    const params = [tier1];
    await delayVaultProvider.connect(user2).createNewDelayVault(user1.address, params);
    const newAmount = await delayVaultProvider.userToAmount(user1.address);
    const type = await delayVaultProvider.userToType(user1.address);
    expect(newAmount).to.equal(tier1);
    // 0 - tier1
    // 1 - tier2
    // 2 - tier3
    expect(type).to.equal(0);
  });

  it('should check delayVault data with tier 2', async () => {
    const params = [tier2];
    await delayVaultProvider.connect(user2).createNewDelayVault(user2.address, params);
    const newAmount = await delayVaultProvider.userToAmount(user2.address);
    const type = await delayVaultProvider.userToType(user2.address);
    expect(newAmount).to.equal(tier2);
    expect(type).to.equal(1);
  });

  it('should check delayVault data with tier 3', async () => {
    const params = [tier3];
    await delayVaultProvider.connect(newOwner).createNewDelayVault(newOwner.address, params);
    const newAmount = await delayVaultProvider.userToAmount(newOwner.address);
    const type = await delayVaultProvider.userToType(newOwner.address);
    expect(newAmount).to.equal(tier3);
    expect(type).to.equal(2);
  });

  describe('delayVault withdraw', async () => {
    it('should withdraw from delayVault with tier 1', async () => {
      const params = [tier1];
      await delayVaultProvider.connect(user3).createNewDelayVault(user3.address, params);
      await lockDealNFT
        .connect(user3)
        ['safeTransferFrom(address,address,uint256)'](user3.address, lockDealNFT.address, poolId);
      const newAmount = await delayVaultProvider.userToAmount(user3.address);
      const type = await delayVaultProvider.userToType(user3.address);
      expect(newAmount).to.equal(0);
      expect(type).to.equal(0);
    });

    it('should withdraw from delayVault with tier 2', async () => {
      const params = [tier2];
      await delayVaultProvider.connect(user3).createNewDelayVault(user3.address, params);
      await lockDealNFT
        .connect(user3)
        ['safeTransferFrom(address,address,uint256)'](user3.address, lockDealNFT.address, poolId);
      const newAmount = await delayVaultProvider.userToAmount(user3.address);
      const type = await delayVaultProvider.userToType(user3.address);
      expect(newAmount).to.equal(0);
      expect(type).to.equal(0);
    });

    it('should withdraw from delayVault with tier 3', async () => {
      const params = [tier3];
      const poolId = await lockDealNFT.totalSupply();
      await delayVaultProvider.connect(user3).createNewDelayVault(user3.address, params);
      await lockDealNFT
        .connect(user3)
        ['safeTransferFrom(address,address,uint256)'](user3.address, lockDealNFT.address, poolId);
      const newAmount = await delayVaultProvider.userToAmount(user3.address);
      const type = await delayVaultProvider.userToType(user3.address);
      expect(newAmount).to.equal(0);
      expect(type).to.equal(0);
    });

    it('should create new deal provider nft after withdraw with first tier', async () => {
      const params = [tier1];
      await delayVaultProvider.connect(user3).createNewDelayVault(user3.address, params);
      await lockDealNFT
        .connect(user3)
        ['safeTransferFrom(address,address,uint256)'](user3.address, lockDealNFT.address, poolId);
      vaultId = await mockVaultManager.Id();
      const simpleNFTdata = await lockDealNFT.getData(poolId.add(1));
      expect(simpleNFTdata.provider).to.equal(dealProvider.address);
      expect(simpleNFTdata.owner).to.equal(user3.address);
      expect(simpleNFTdata.token).to.equal(token);
      expect(simpleNFTdata.vaultId).to.equal(vaultId);
      expect(simpleNFTdata.params).to.deep.equal([tier1]);
    });

    it('should create new lock provider nft after withdraw with second tier', async () => {
      const params = [tier2];
      await delayVaultProvider.connect(user3).createNewDelayVault(user3.address, params);
      await lockDealNFT
        .connect(user3)
        ['safeTransferFrom(address,address,uint256)'](user3.address, lockDealNFT.address, poolId);
      const time = await ethers.provider.getBlock('latest').then(block => block.timestamp);
      vaultId = await mockVaultManager.Id();
      const simpleNFTdata = await lockDealNFT.getData(poolId.add(1));
      expect(simpleNFTdata.provider).to.equal(lockProvider.address);
      expect(simpleNFTdata.owner).to.equal(user3.address);
      expect(simpleNFTdata.token).to.equal(token);
      expect(simpleNFTdata.vaultId).to.equal(vaultId);
      expect(simpleNFTdata.params).to.deep.equal([tier2, time + startTime]);
    });

    it('should create new timed provider nft after withdraw with third tier', async () => {
      const params = [tier3];
      await delayVaultProvider.connect(user3).createNewDelayVault(user3.address, params);
      await lockDealNFT
        .connect(user3)
        ['safeTransferFrom(address,address,uint256)'](user3.address, lockDealNFT.address, poolId);
      const time = await ethers.provider.getBlock('latest').then(block => block.timestamp);
      vaultId = await mockVaultManager.Id();
      const simpleNFTdata = await lockDealNFT.getData(poolId.add(1));
      expect(simpleNFTdata.provider).to.equal(timedDealProvider.address);
      expect(simpleNFTdata.owner).to.equal(user3.address);
      expect(simpleNFTdata.token).to.equal(token);
      expect(simpleNFTdata.vaultId).to.equal(vaultId);
      expect(simpleNFTdata.params).to.deep.equal([tier3, time + startTime, time + finishTime, tier3]);
    });
  });

  describe('delayVault split', async () => {
    it('should return half amount in old pool after split', async () => {
      const params = [tier1];
      const packedData = ethers.utils.defaultAbiCoder.encode(['uint256', 'address'], [ratio, user4.address]);
      await delayVaultProvider.connect(user4).createNewDelayVault(user4.address, params);
      await lockDealNFT.connect(user4)['safeTransferFrom(address,address,uint256,bytes)'](user4.address, lockDealNFT.address, poolId, packedData);
      const data = await lockDealNFT.getData(poolId);
      expect(data.owner).to.equal(user4.address);
      expect(data.provider).to.equal(delayVaultProvider.address);
      expect(data.params).to.deep.equal([tier1.div(2)]);
    });

    it('should create new delay nft after split with first tier', async () => {
      const params = [tier1];
      const packedData = ethers.utils.defaultAbiCoder.encode(['uint256', 'address'], [ratio, user3.address]);
      await delayVaultProvider.connect(user3).createNewDelayVault(user3.address, params);
      await lockDealNFT
        .connect(user3)
        ['safeTransferFrom(address,address,uint256,bytes)'](user3.address, lockDealNFT.address, poolId, packedData);
      const data = await lockDealNFT.getData(poolId.add(1));
      expect(data.owner).to.equal(user3.address);
      expect(data.provider).to.equal(delayVaultProvider.address);
      expect(data.params).to.deep.equal([tier1.div(2)]);
    });

    it('should create new delay nft after split with second tier', async () => {
      const params = [tier2];
      const packedData = ethers.utils.defaultAbiCoder.encode(['uint256', 'address'], [ratio, user3.address]);
      await delayVaultProvider.connect(user3).createNewDelayVault(user3.address, params);
      await lockDealNFT
        .connect(user3)
        ['safeTransferFrom(address,address,uint256,bytes)'](user3.address, lockDealNFT.address, poolId, packedData);
      const data = await lockDealNFT.getData(poolId.add(1));
      expect(data.owner).to.equal(user3.address);
      expect(data.provider).to.equal(delayVaultProvider.address);
      expect(data.params).to.deep.equal([tier2.div(2)]);
    });

    it('should create new delay nft after split with third tier', async () => {
      const params = [tier3];
      await delayVaultProvider.connect(user3).createNewDelayVault(user3.address, params);
      const packedData = ethers.utils.defaultAbiCoder.encode(['uint256', 'address'], [ratio, user3.address]);
      await lockDealNFT
        .connect(user3)
        ['safeTransferFrom(address,address,uint256,bytes)'](user3.address, lockDealNFT.address, poolId, packedData);
      const data = await lockDealNFT.getData(poolId.add(1));
      expect(data.owner).to.equal(user3.address);
      expect(data.provider).to.equal(delayVaultProvider.address);
      expect(data.params).to.deep.equal([tier3.div(2)]);
    });
  });
});
