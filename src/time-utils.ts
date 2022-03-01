import { providers, BigNumber } from 'ethers'

const advanceBlock = async (provider: providers.JsonRpcProvider): Promise<any> => {
  return provider.send('evm_mine', [])
}

// Advance the block to the passed height
const advanceBlockTo = async (target: string | BigNumber, provider: providers.JsonRpcProvider): Promise<void> => {
  if (!BigNumber.isBigNumber(target)) {
    target = BigNumber.from(target)
  }

  const currentBlock = await latestBlock(provider)
  const start = Date.now()
  let notified

  if (target.lt(currentBlock)) throw Error(`Target block #(${target}) is lower than current block #(${currentBlock})`)

  while ((await latestBlock(provider)).lt(target)) {
    if (!notified && Date.now() - start >= 5000) {
      notified = true
      console.log('advanceBlockTo: Advancing too many blocks is causing this test to be slow.')
    }
    await advanceBlock(provider)
  }
}

// Returns the time of the last mined block in seconds
const latest = async (provider: providers.JsonRpcProvider): Promise<BigNumber> => {
  const block = await provider.getBlock('latest')
  return BigNumber.from(block.timestamp)
}

const latestBlock = async (provider: providers.JsonRpcProvider): Promise<BigNumber> => {
  const block = await provider.getBlock('latest')
  return BigNumber.from(block.number)
}

// Increases ganache time by the passed duration in seconds
const increase = async (duration: string | BigNumber, provider: providers.JsonRpcProvider): Promise<void> => {
  if (!BigNumber.isBigNumber(duration)) {
    duration = BigNumber.from(duration)
  }

  if (duration.isNegative()) throw Error(`Cannot increase time by a negative amount (${duration})`)

  provider.send('evm_increaseTime', [duration.toNumber()])

  await advanceBlock(provider)
}

/**
 * Beware that due to the need of calling two separate ganache methods and rpc calls overhead
 * it's hard to increase time precisely to a target point so design your test to tolerate
 * small fluctuations from time to time.
 *
 * @param target time in seconds
 */
const increaseTo = async (target: string | BigNumber, provider: providers.JsonRpcProvider): Promise<void> => {
  if (!BigNumber.isBigNumber(target)) {
    target = BigNumber.from(target)
  }

  const now = await latest(provider)

  if (target.lt(now)) throw Error(`Cannot increase current time (${now}) to a moment in the past (${target})`)
  const diff = target.sub(now)
  return increase(diff, provider)
}

export const time = {
  latest,
  latestBlock,
  increase,
  increaseTo,
}

export const duration = {
  seconds: function (val: string | number) {
    return BigNumber.from(val)
  },
  minutes: function (val: string | number) {
    return BigNumber.from(val).mul(this.seconds('60'))
  },
  hours: function (val: string | number) {
    return BigNumber.from(val).mul(this.minutes('60'))
  },
  days: function (val: string | number) {
    return BigNumber.from(val).mul(this.hours('24'))
  },
  weeks: function (val: string | number) {
    return BigNumber.from(val).mul(this.days('7'))
  },
  years: function (val: string | number) {
    return BigNumber.from(val).mul(this.days('365'))
  },
}
