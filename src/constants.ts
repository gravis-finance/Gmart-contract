import { BigNumber } from 'ethers'

const bits = BigNumber.from(10).pow(BigNumber.from(18))

export const Constants = {
  Exchange: {
    feeRecipient: '0xd986b2729416ffDFAF2fa0e4E6b5a2453cf6C323',
    feeAmount: 300,
    tokens: ['0x1A2a8CAba8552773fC118AD8b9A0e077465082EB'],
    stables: [
      '0xe9e7cea3dedca5984780bafc599bd69add087d56', // BUSD
      '0x55d398326f99059ff775485246999027b3197955', // USDC
      '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d', // USDT
    ],
    types: [0, 1, 2],
  },
  ExchangeV3: {
    feeRecipient1: '0xd986b2729416ffDFAF2fa0e4E6b5a2453cf6C323',
    feeRecipient2: '0xd986b2729416ffDFAF2fa0e4E6b5a2453cf6C323',
    feeAmount1: 300,
    feeAmount2: 300,
    tokens: ['0x1A2a8CAba8552773fC118AD8b9A0e077465082EB'],
    stables: [
      '0xe9e7cea3dedca5984780bafc599bd69add087d56', // BUSD
      '0x55d398326f99059ff775485246999027b3197955', // USDC
      '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d', // USDT
    ],
  },
}
