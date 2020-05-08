import * as datalog from './datalog'
import { Added, Modified, Removed } from './datalog'
import * as ViewExt from './view-ext'

describe("Map", () => {
  test("maps simple values", () => {
    const table = datalog.intoTable([
      { n: 0 },
      { n: 1 },
      { n: 2 },
    ])
    const view = table.view()
    const viewExt = new ViewExt.Impl(view)
    const mappedView = viewExt.map(({ n }) => ({ n: n + 1 }))
    expect(mappedView.readAllData()).toEqual([
      { n: 1 },
      { n: 2 },
      { n: 3 },
    ])

    table.retract({ n: 2 })
    expect(mappedView.readAllData()).toEqual([
      { n: 1 },
      { n: 2 },
    ])
  })

  test("dedups in map", () => {
    const table = datalog.intoTable([
      { a: 0, b: 1 },
      { a: 1, b: 1 },
      { a: 1, b: 2 },
    ])
    const view = table.view()
    const viewExt = new ViewExt.Impl(view)
    const mappedView = viewExt.map(({ a }) => ({ a }))
    while (mappedView.recentData()) { }
    expect(mappedView.readAllData()).toEqual([
      { a: 0 },
      { a: 1 },
    ])

    table.retract({ a: 1, b: 2 })
    expect(mappedView.readAllData()).toEqual([
      { a: 0 },
      { a: 1 },
    ])
  })
})

describe("Reduce", () => {
  test("Reduces simple cases", () => {
    const table = datalog.intoTable([
      { n: 0 },
      { n: 1 },
      { n: 2 },
    ])
    const view = table.view()
    const viewExt = new ViewExt.Impl(view)
    const reducedView = viewExt.reduce((acc, { kind, datum: { n } }) => {
      switch (kind) {
        case datalog.Added:
          return acc + n
        case datalog.Removed:
          return acc - n
        case datalog.Modified:
          throw new Error("Wasn't expected a modification")
      }
    }, 0)

    expect(reducedView.readAllData()).toEqual([
      3,
    ])

    table.retract({ n: 2 })
    expect(reducedView.recentData()).toEqual([
      { kind: datalog.Modified, datum: 1, oldDatum: 3 }
    ])
  })
})


describe("SortBy", () => {
  test("Refresh datalog.gallop memory", () => {
    expect(datalog.gallop([0, 1, 2, 4], (n: number) => n < 3)).toBe(3)
    expect(datalog.gallop([0, 1, 2, 4], (n: number) => n < -1)).toBe(0)
    expect(datalog.gallop([0, 1, 2, 4], (n: number) => n < 5)).toBe(4)
    expect(datalog.gallop([0, 1, 2, 4], (n: number) => n < 2)).toBe(2)
  })

  test("Sort tuple on Objects", () => {
    expect(datalog.sortTuple({ a: 1 }, { a: 1, b: 2 })).toBe(0)
    expect(datalog.sortTuple({ a: 1 }, { a: 2, b: 2 })).toBe(0)
  })

  test("Simple Sort", () => {
    const table = datalog.intoTable([
      { n: 1 },
      { n: 6 },
      { n: 2 },
      { n: 5 },
      { n: 0 },
    ])

    const view = table.view()
    const viewExt = new ViewExt.Impl(view)
    const sortedView = viewExt.sortBy(({ n: a }, { n: b }) => a < b ? -1 : a > b ? 1 : 0)

    expect(sortedView.readAllData()).toEqual([
      { datum: { n: 0 }, index: 0 },
      { datum: { n: 1 }, index: 1 },
      { datum: { n: 2 }, index: 2 },
      { datum: { n: 5 }, index: 3 },
      { datum: { n: 6 }, index: 4 },
    ])

    table.assert({ n: 3 })
    expect(sortedView.recentData()).toEqual(
      [
        { kind: Added, datum: { index: 3, datum: { n: 3 } } },
      ]
    )

    table.retract({ n: 2 })
    expect(sortedView.recentData()).toEqual(
      [
        { kind: Removed, datum: { index: 2, datum: { n: 2 } } },
      ]
    )
  })

  test("Take from sorted", () => {
    const table = datalog.intoTable([
      { n: 1 },
      { n: 6 },
      { n: 2 },
      { n: 5 },
      { n: 0 },
    ])

    const view = table.view()
    const viewExt = new ViewExt.Impl(view)
    const sortedView = viewExt.sortBy(({ n: a }, { n: b }) => a < b ? -1 : a > b ? 1 : 0)
    const takedView = sortedView.take(3)

    expect(takedView.readAllData()).toEqual([
      { datum: { n: 0 }, index: 0 },
      { datum: { n: 1 }, index: 1 },
      { datum: { n: 2 }, index: 2 },
    ])

    const dropedView = sortedView.drop(2)

    expect(dropedView.readAllData()).toEqual([
      { datum: { n: 2 }, index: 2 },
      { datum: { n: 5 }, index: 3 },
      { datum: { n: 6 }, index: 4 },
    ])

    const dropedViewAgain = dropedView.drop(1)

    expect(dropedViewAgain.readAllData()).toEqual([
      { datum: { n: 5 }, index: 3 },
      { datum: { n: 6 }, index: 4 },
    ])

    const takedView2 = dropedViewAgain.take(1)

    expect(takedView2.readAllData()).toEqual([
      { datum: { n: 5 }, index: 3 },
    ])
    const dropped3 = takedView.drop(1)

    expect(dropped3.readAllData()).toEqual([
      { datum: { n: 1 }, index: 1 },
      { datum: { n: 2 }, index: 2 },
    ])

    table.retract({ n: 2 })

    expect(dropped3.readAllData()).toEqual([
      { datum: { n: 1 }, index: 1 },
      { datum: { n: 5 }, index: 2 },
    ])
  })
  test("OrderBy", () => {
    const table = datalog.intoTable([
      { n: 1 },
      { n: 6 },
      { n: 2 },
      { n: 5 },
      { n: 0 },
    ])

    const view = table.view()
    const viewExt = new ViewExt.Impl(view)
    const sortedView = viewExt.orderBy('n', true)

    expect(sortedView.readAllData()).toEqual([
      { datum: { n: 0 }, index: 0 },
      { datum: { n: 1 }, index: 1 },
      { datum: { n: 2 }, index: 2 },
      { datum: { n: 5 }, index: 3 },
      { datum: { n: 6 }, index: 4 },
    ])

    const sortedOppositeView = viewExt.orderBy('n', false)

    expect(sortedView.readAllData()).toEqual([
      { datum: { n: 6 }, index: 0 },
      { datum: { n: 5 }, index: 1 },
      { datum: { n: 2 }, index: 2 },
      { datum: { n: 1 }, index: 3 },
      { datum: { n: 0 }, index: 4 },
    ])
  })
})