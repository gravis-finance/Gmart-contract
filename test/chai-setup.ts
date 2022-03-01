import chaiModule from 'chai'
import { chaiEthers } from 'chai-ethers'
import { BigNumber } from 'ethers'

chaiModule.use(chaiEthers)

chaiModule.use(function (chai, utils) {
  chai.Assertion.addMethod('almostEqualDiv1e18', function (this: any, value: any) {
    const expectedOrig = BigNumber.from(value)
    const actualOrig = BigNumber.from(this._obj)

    const _1e18 = BigNumber.from('10').pow(BigNumber.from('18'))
    const expected = expectedOrig.div(_1e18)
    const actual = actualOrig.div(_1e18)

    this.assert(
      expected.eq(actual) ||
        expected.add(1).eq(actual) ||
        expected.add(2).eq(actual) ||
        actual.add(1).eq(expected) ||
        actual.add(2).eq(expected),
      'expected #{act} to be almost equal #{exp}',
      'expected #{act} to be different from #{exp}',
      expectedOrig.toString(),
      actualOrig.toString()
    )
  })
})

chaiModule.use(chaiEthers)

export = chaiModule

declare global {
  export namespace Chai {
    interface Assertion {
      almostEqualDiv1e18(expectedText: string | BigNumber): Promise<void>
    }
  }
}
