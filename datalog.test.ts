import * as datalog from './datalog'
// @ts-ignore
import * as DataFrog from 'datafrog-js'

type PersonID = number

// describe('Free Variable', () => {
//     test('Constrains', () => {
//         // { id: PersonID, name: String}
//         const person = datalog.Relation<{ id: PersonID, name: string }>()
//         const v = new datalog.FreeVariable()
//         v.constrain([1, 2, 3, 4])
//         expect(v.availableValues).toStrictEqual([1, 2, 3, 4]);
//         v.constrain([2, 3])
//         expect(v.availableValues).toStrictEqual([2, 3]);
//     });
// })

describe('Relation', () => {
    // test('Returns a function', () => {
    // { id: PersonID, name: String}
    // const person = datalog.Relation<{ id: PersonID, name: string }>()

    // expect(typeof person).toBe("function");
    // });
    const newPerson = () => new datalog.RelationIndex<"id", PersonID, { name: string }>([], ["id", "name"])

    test('Inserts something in the correct place', () => {
        // { id: PersonID, name: String}
        const person = newPerson()

        expect(person.elements).toEqual([])
        person.assert({ id: 0, name: "marco" })
        expect(person.elements).toEqual([[0, "marco"]])
        person.assert({ id: 1, name: "daiyi" })
        expect(person.elements).toEqual([[0, "marco"], [1, "daiyi"]])
    });

    test('indexBy', () => {
        const A = new datalog.RelationIndex<"a", number, { b: number }>([], ["a", "b"])
        A.assert({ a: 1, b: 2 })

        const B = A.indexBy(['b', 'a'])
        expect(B.elements).toEqual([[2, 1]])
    })

    test('ExtendWith & Leaper works', () => {
        // { id: PersonID, name: String}
        const person = newPerson()
        person.assert({ id: 0, name: "marco" })
        person.assert({ id: 1, name: "daiyi" })
        person.assert({ id: 2, name: "beba" })

        const personExtendedWith = person.extendWith(([id]: [PersonID]) => id);
        expect(personExtendedWith.count([0])).toEqual(1)
        // expect(personExtendedWith.propose([0])).toEqual([["marco"]])
        // expect(personExtendedWith.intersect([0], [["marcopolo"], ["marco"]])).toEqual([["marco"]])
    });

    test('ExtendWith & Leaper works', () => {
        // { id: PersonID, name: String}
        const person = newPerson()
        person.assert({ id: 0, name: "marco" })
        person.assert({ id: 0, name: "foo" })

        const personExtendedWith = person.extendWith(([id]: [PersonID]) => id);
        expect(personExtendedWith.count([0])).toEqual(2)
    });

    test('LeapJoin', () => {
        // { id: PersonID, name: String}
        const A = new datalog.RelationIndex<"a", number, { b: number }>([], ["a", "b"])
        const B = new datalog.RelationIndex<"b", number, { c: number }>([], ["b", "c"])
        const C = new datalog.RelationIndex<"a", number, { c: number }>([], ["a", "c"])

        A.assert({ a: 1, b: 2 })
        B.assert({ b: 2, c: 3 })
        B.assert({ b: 2, c: 4 })
        C.assert({ a: 1, c: 3 })

        const out: Array<[number, number, number]> = []
        datalog.leapJoinHelper(A, [B.extendWith(([_, b]) => b), C.extendWith(([a, _]) => a)], ([a, b], [c]) => {
            out.push([a, b, c])

        })
        expect(out).toEqual([[1, 2, 3]])
    });

    test('LeapJoin2', () => {
        // { id: PersonID, name: String}
        const A = new datalog.RelationIndex<"a", number, { b: number }>([], ["a", "b"])
        const B = new datalog.RelationIndex<"b", number, { c: number }>([], ["b", "c"])
        const C = new datalog.RelationIndex<"a", number, { c: number }>([], ["a", "c"])

        A.assert({ a: 1, b: 2 })
        B.assert({ b: 2, c: 3 })
        B.assert({ b: 2, c: 4 })
        C.assert({ a: 1, c: 3 })
        C.assert({ a: 1, c: 4 })

        const out: Array<[number, number, number]> = []
        datalog.leapJoinHelper(A, [B.extendWith(([_, b]) => b), C.extendWith(([a, _]) => a)], ([a, b], [c]) => {
            out.push([a, b, c])

        })

        expect(out).toEqual([[1, 2, 3], [1, 2, 4]])
    });

    test("join key ordering", () => {
        const out = datalog.joinKeyOrdering([
            ["a", "b"],
            ["b", "c"],
            ["a", "c", "d"]
        ])

        expect(out).toEqual(["a", "b", "c", "d"])
    })

    test('LeapJoin3', () => {
        // { id: PersonID, name: String}
        const A = new datalog.RelationIndex<"a", number, { b: number }>([], ["a", "b"])
        const B = new datalog.RelationIndex<"b", number, { c: number }>([], ["b", "c"])
        const C = new datalog.RelationIndex<"a", number, { c: number, d: number }>([], ["a", "c", "d"])

        A.assert({ a: 1, b: 2 })
        B.assert({ b: 2, c: 3 })
        B.assert({ b: 2, c: 4 })
        C.assert({ a: 1, c: 3, d: 0 })

        const out: Array<[number, number, number, any]> = []
        datalog.leapJoinHelper(A, [
            new datalog.ExtendWithAndCarry(
                ([_, b]) => b,
                (out => [out, {}]), // nothing to carry
                B
            ),
            new datalog.ExtendWithAndCarry(
                ([a, _]) => a,
                ([out, d]) => [[out], { d }],
                C
            )

        ], ([a, b], [[c], carried]) => {
            out.push([a, b, c, carried])
        })

        expect(out).toEqual([[1, 2, 3, { d: 0 }]])
        const jointKeyOrder = datalog.joinKeyOrdering([
            ["a", "b"],
            ["b", "c"],
            ["a", "c", "d"]
        ])

        const objects = out.map(tuple => tuple.slice(0, tuple.length - 1).reduce((acc, val, i) => {
            acc[jointKeyOrder[i]] = val
            return acc
        }, tuple[tuple.length - 1]))

        expect(objects).toEqual([{ a: 1, b: 2, c: 3, d: 0 }])
    });

    test('Using the Unconstrained symbol in joins to specify columns that are not constrained', () => {
        const A = new datalog.RelationIndex<"a", number, { b: number }>([], ["a", "b"])
        const B = new datalog.RelationIndex<"b", number, { c: number }>([], ["b", "c"])
        const C = new datalog.RelationIndex<"a", number, { c: number, d: number }>([], ["a", "c", "d"])

        A.assert({ a: 1, b: 2 })
        B.assert({ b: 2, c: 3 })
        B.assert({ b: 2, c: 4 })
        C.assert({ a: 1, c: 3, d: 0 })
        C.assert({ a: 1, c: 3, d: 2 })
        C.assert({ a: 1, c: 3, d: 4 })

        // const BLeaper = new datalog.ExtendWithUnconstrained(
        //     ([_a, b]: [number, number]) => b,
        //     ["c", "d"],
        //     B
        // )
        // expect(BLeaper.outputTupleFunc([3])).toEqual([3, datalog.Unconstrained])

        const out: Array<[number, number, ...(number | symbol)[]]> = []

        datalog.leapJoinHelper(A, [
            new datalog.ExtendWithUnconstrained(
                ([_a, b]) => b,
                ["c", "d"],
                B
            ),
            new datalog.ExtendWithUnconstrained(
                ([a, _b]) => a,
                ["c", "d"],
                C
            ),
        ], ([a, b], rest) => {
            out.push([a, b, ...rest])
        })
        expect(out).toEqual([[1, 2, 3, 0], [1, 2, 3, 2], [1, 2, 3, 4]])

        expect(DataFrog.sortTuple([datalog.Unconstrained, 1], [2, 1])).toEqual(0)
    })

    test('Filter ou missing keys', () => {
        // Say relation B has keys ['c', 'b']
        // and our output tuple key order is ['a', 'b', 'c', 'd']
        // We should index B by ['b', 'c']

        expect(
            datalog.filterKeys(['b', 'c'], ['a', 'b', 'c', 'd'])
        ).toEqual(['b', 'c'])



    })

    test('Order leaper keys', () => {
        let restKeys = [
            ['c', 'e'],
            ['c', 'd'],
            ['c', 'd', 'e'],
        ]

        let minIdx = 0
        restKeys.forEach((ks, i) => {
            if (ks.length < restKeys[minIdx].length) {
                minIdx = i
            }
        })

        let setWithLeastKeys = new Set(restKeys[minIdx])
        restKeys = restKeys.filter((_, i) => i !== minIdx)

        let currentIdx = 0

        // Split between common keys and rest of the keys
        const restKeysSplit: Array<[Array<string>, Array<string>]> = restKeys.map(() => [[], []])

        restKeys.forEach((ks, j) => {
            ks.forEach(rest_k => {
                if (setWithLeastKeys.has(rest_k)) {
                    restKeysSplit[j][0].push(rest_k)
                } else {
                    restKeysSplit[j][1].push(rest_k)
                }
            })
        })

        restKeys = restKeysSplit.map(([common, rest]) => common.concat(rest))
        // while (currentIdx < setWithLeastKeys.length) {
        //     const k = setWithLeastKeys[currentIdx]
        //     restKeys.forEach(ks => {
        //         ks
        //     })
        // }
    })
})

describe("MultiIndexRelations", () => {
    test("MultiIndex can indexBy", () => {
        const A = new datalog.Relation<{ a: number, b: number }>()
        A.assert({ a: 1, b: 2 })
        A.indexBy(['a', 'b'])
        expect(A.relations[0].elements).toEqual([[1, 2]])
        A.indexBy(['b', 'a'])
        expect(A.relations[0].elements).toEqual([[1, 2]])
        expect(A.relations[1].elements).toEqual([[2, 1]])
    })
})

describe("Variables", () => {
    test("Variables can be told stuff", () => {
        const A = new datalog.Variable<{ a: number, b: number }>()
        A.assert({ a: 1, b: 2 })
        expect(A.changed()).toEqual(true)
        expect(A.changed()).toEqual(false)
        expect(A.stable.relations[0].keyOrdering).toEqual(["a", "b"])
        expect(A.stable.relations[0].elements).toEqual([[1, 2]])
        expect(A.changed()).toEqual(false)

        A.assert({ a: 1, b: 2 })
        expect(A.changed()).toEqual(false)
        expect(A.stable.relations[0].elements).toEqual([[1, 2]])

        A.assert({ a: 2, b: 3 })
        expect(A.changed()).toEqual(true)
        expect(A.changed()).toEqual(false)
        expect(A.stable.relations[0].elements).toEqual([[1, 2], [2, 3]])
    })

    test("Joining Variables", () => {
        const A = new datalog.Variable<{ a: number, b: number }>()
        const B = new datalog.Variable<{ b: number, c: number }>()
        const C = new datalog.Variable<{ c: number, a: number, d: number }>()
        A.assert({ a: 1, b: 2 })
        B.assert({ b: 2, c: 3 })
        B.assert({ b: 2, c: 4 })
        C.assert({ a: 1, c: 3, d: 5 })
        C.assert({ a: 1, c: 3, d: 7 })

        let out: Array<{ a: number, b: number, c: number, d: number }> = []
        for (let join of datalog.variableJoinHelperGen(A, B, C)) {
            out.push(join)
        }

        expect(out).toEqual([
            { a: 1, b: 2, c: 3, d: 5 },
            { a: 1, b: 2, c: 3, d: 7 }
        ])
    })
})













