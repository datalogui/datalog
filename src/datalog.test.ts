import * as datalog from './datalog'
// @ts-ignore
// import * as DataFrog from 'datafrog-js'
import * as DataFrog from '../datafrog-js/index.js'

function intoAddedDatums<T>(v: Array<T>): Array<datalog.RecentDatum<T>> {
    return v.map(datum => ({ kind: datalog.Added, datum }))
}

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

describe.skip("Playground", () => {
    test("Generators", () => {
        console.log('here')
        function count(n: number, cb: (i: number) => void) {
            for (let i = 0; i < n; i++) {
                cb(i)
            }
        }

        function countGen(n: number): Iterable<number> {
            const out: any = [];
            count(n, i => out.push(i))
            return out[Symbol.iterator]()
        }

        console.log(count(10, (n) => console.log(n)))
        console.log([...countGen(10)])
    })
})

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

    test('Can filter by constants', () => {
        // { id: PersonID, name: String}
        const person = newPerson()

        person.assert({ id: 0, name: "marco" })
        person.assert({ id: 1, name: "daiyi" })
        const filteredPeople = person.filterElements({ name: "marco" })
        expect(filteredPeople.elements).toEqual([[0, "marco"]])
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

    test("join key ordering 2", () => {
        const out = datalog.joinKeyOrdering([
            ["a", "b"],
            ["b", "a"],
        ])

        expect(out).toEqual(["a", "b"])
    })

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
                ([_a, b]) => [b],
                1,
                ["c", "d"],
                B,
                ["b", "c"]
            ),
            new datalog.ExtendWithUnconstrained(
                ([a, _b]) => [a],
                1,
                ["c", "d"],
                C,
                ["a", "c", "d"]
            ),
        ], ([a, b], rest) => {
            out.push([a, b, ...rest])
        })
        expect(out).toEqual([[1, 2, 3, 0], [1, 2, 3, 2], [1, 2, 3, 4]])

        expect(DataFrog.sortTuple([datalog.Unconstrained, 1], [2, 1])).toEqual(0)
    })

    test('Test AntiExtendWithUnconstrained', () => {
        const A = new datalog.RelationIndex<"a", number, { b: number }>([], ["a", "b"])
        const B = new datalog.RelationIndex<"b", number, { c: number }>([], ["b", "c"])
        const C = new datalog.RelationIndex<"a", number, { c: number }>([], ["a", "c"])
        const Cneg = new datalog.RelationIndex<"a", number, { c: number }>([], ["a", "c"])

        A.assert({ a: 1, b: 2 })
        B.assert({ b: 2, c: 3 })
        B.assert({ b: 2, c: 4 })
        C.assert({ a: 1, c: 3 })
        C.assert({ a: 1, c: 4 })
        Cneg.assert({ a: 1, c: 3 })

        // Cneg.assert({ a: 1, c: 3 })

        // const BLeaper = new datalog.ExtendWithUnconstrained(
        //     ([_a, b]: [number, number]) => b,
        //     ["c", "d"],
        //     B
        // )
        // expect(BLeaper.outputTupleFunc([3])).toEqual([3, datalog.Unconstrained])

        const out: Array<[number, number, ...(number | symbol)[]]> = []

        datalog.leapJoinHelper(A, [
            new datalog.ExtendWithUnconstrained(
                ([_a, b]) => [b],
                1,
                ["c"],
                B,
                ["b", "c"]
            ),
            new datalog.ExtendWithUnconstrained(
                ([a, _b]) => [a],
                1,
                ["c"],
                C,
                ["a", "c"]
            ),
            new datalog.ExtendWithUnconstrained(
                ([a, _b]) => [a],
                1,
                ["c"],
                Cneg,
                ["a", "c"],
                true
            ),
        ], ([a, b], rest) => {
            out.push([a, b, ...rest])
        })
        expect(out).toEqual([[1, 2, 4]])

        expect(DataFrog.sortTuple([datalog.Unconstrained, 1], [2, 1])).toEqual(0)
    })

    test('Filter out missing keys', () => {
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
        datalog.variableJoinHelper(join => out.push(join), [A, B, C], [{ a: 'a', b: 'b' }, { b: 'b', c: 'c' }, { a: 'a', c: 'c', d: 'd' }], [{}, {}, {}])

        expect(out).toEqual([
            { a: 1, b: 2, c: 3, d: 5 },
            { a: 1, b: 2, c: 3, d: 7 }
        ])
    })

    test("Joining Empty Variables", () => {
        const A = new datalog.Variable<{ a: number, b: number }>()
        const B = new datalog.Variable<{ b: number, c: number }>()
        const C = new datalog.Variable<{ c: number, a: number, d: number }>()

        let out: Array<{ a: number, b: number, c: number, d: number }> = [...datalog.variableJoinHelperGen([A, B, C], [{ a: 'a', b: 'b' }, { b: 'b', c: 'c' }, { a: 'a', c: 'c', d: 'd' }], [{}, {}, {}])]

        expect(out).toEqual([])
    })

    test("Joining 1 Variable", () => {
        const A = new datalog.Variable<{ a: number, b: number }>()

        let out: Array<{ a: number, b: number }> = [...datalog.variableJoinHelperGen([A], [{ a: 'a', b: 'b' }], [{}])]
        expect(out).toEqual([])

        A.assert({ a: 1, b: 2 })
        out = [...datalog.variableJoinHelperGen([A], [{ a: 'a', b: 'b' }], [{}])]
        expect(out).toEqual([{ a: 1, b: 2 }])
    })

    test("Joining 1 Variable with constants", () => {
        const A = new datalog.Variable<{ a: number, b: number }>()

        let out: Array<{ a: number, b: number }> = [...datalog.variableJoinHelperGen([A], [{ a: 'a', b: 'b' }], [{}])]
        expect(out).toEqual([])

        A.assert({ a: 1, b: 2 })
        A.assert({ a: 2, b: 3 })
        out = [...datalog.variableJoinHelperGen([A], [{ a: 'a', b: 'b' }], [{ a: 1 }])]
        expect(out).toEqual([{ a: 1, b: 2 }])
    })

    test("Joining 2 Variables", () => {
        const A = new datalog.Variable<{ a: number, b: number }>()
        const B = new datalog.Variable<{ b: number, c: number }>()

        let out: Array<{ a: number, b: number, c: number }> = [...datalog.variableJoinHelperGen([A, B], [{ a: 'a', b: 'b' }, { b: 'b', c: 'c' }], [{}, {}])]
        expect(out).toEqual([])

        A.assert({ a: 1, b: 2 })
        A.assert({ a: 1, b: 4 })
        B.assert({ b: 2, c: 3 })
        out = [...datalog.variableJoinHelperGen([A, B], [{ a: 'a', b: 'b' }, { b: 'b', c: 'c' }], [{}, {}])]
        expect(out).toEqual([{ a: 1, b: 2, c: 3 }])
    })


    test("Joining 2 Variables with constants", () => {
        const A = new datalog.Variable<{ a: number, b: number }>()
        const B = new datalog.Variable<{ b: number, c: number }>()

        let out: Array<{ a: number, b: number, c: number }> = [...datalog.variableJoinHelperGen([A, B], [{ a: 'a', b: 'b' }, { b: 'b', c: 'c' }], [{}, {}])]
        expect(out).toEqual([])

        A.assert({ a: 1, b: 2 })
        A.assert({ a: 1, b: 4 })
        A.assert({ a: 2, b: 2 })
        A.assert({ a: 3, b: 2 })
        B.assert({ b: 2, c: 3 })
        out = [...datalog.variableJoinHelperGen([A, B], [{ a: 'a', b: 'b' }, { b: 'b', c: 'c' }], [{ a: 1 }, {}])]
        expect(out).toEqual([{ a: 1, b: 2, c: 3 }])

    })

    test("Joining 2 Variables with constants 2", () => {
        const A = new datalog.Variable<{ a: number, b: number }>()
        const B = new datalog.Variable<{ b: number, c: number }>()

        let out: Array<{ a: number, b: number, c: number }> = [...datalog.variableJoinHelperGen([A, B], [{ a: 'a', b: 'b' }, { b: 'b', c: 'c' }], [{}, {}])]
        expect(out).toEqual([])

        A.assert({ a: 1, b: 2 })
        A.assert({ a: 1, b: 4 })
        A.assert({ a: 2, b: 5 })
        A.assert({ a: 3, b: 4 })
        B.assert({ b: 2, c: 3 })

        out = [...datalog.variableJoinHelperGen([A, B], [{ a: 'a', b: 'b' }, { b: 'b', c: 'c' }], [{}, { c: 3 }])]
        expect(out).toEqual([{ a: 1, b: 2, c: 3 }])
    })

    test("Joining 1 Variable with remapped keys", () => {
        const A = new datalog.Variable<{ a: number, b: number }>()

        // let out: Array<{ a2: number, b2: number }> = [...datalog.variableJoinHelperGen([A], [{ a: 'a', b: 'b' }])]
        // expect(out).toEqual([])

        A.assert({ a: 1, b: 2 })
        // @ts-ignore
        let out = [...datalog.variableJoinHelperGen<{ a: number, b: number }, { a2: number, b2: number }>([A], [{ a: 'a2', b: 'b2' }], [{}])]
        expect(out).toEqual([{ a2: 1, b2: 2 }])
    })

    test("Joining same Variable with itself with remapped keys", () => {
        const A = new datalog.Variable<{ a: number, b: number }>()

        A.assert({ a: 1, b: 2 })
        A.assert({ a: 2, b: 1 })
        A.assert({ a: 3, b: 1 })
        A.assert({ a: 5, b: 1 })
        A.assert({ a: 3, b: 2 })
        // @ts-ignore
        let out = [...datalog.variableJoinHelperGen<{ a: number, b: number }, { b: number, a: number }>([A, A], [{ a: 'a', b: 'b' }, { a: 'b', b: 'a' }], [{}, {}])]
        expect(out).toEqual([{ a: 1, b: 2 }, { a: 2, b: 1 }])
    })

    test("Joining same Variable with itself with remapped keys", () => {
        const A = new datalog.Variable<{ a: number, b: number }>()

        A.assert({ a: 3, b: 4 })
        A.assert({ a: 1, b: 2 })
        A.assert({ a: 1, b: 1 })
        // @ts-ignore
        let out = [...datalog.variableJoinHelperGen([A, A], [{ a: 'a' }, { b: 'a' }], [{}, {}])]
        // TODO this should be just one value
        expect(out).toEqual([{ a: 1 }, { a: 1 }])
    })

    test("Joining non-overlapping relations", () => {
        const A = new datalog.Variable<{ a: number, b: number }>()
        const B = new datalog.Variable<{ c: number, d: number }>()

        A.assert({ a: 1, b: 2 })
        A.assert({ a: 3, b: 4 })
        B.assert({ c: 5, d: 6 })
        B.assert({ c: 7, d: 8 })

        // @ts-ignore
        let out = [...datalog.variableJoinHelperGen<{ a: number, b: number }, { c: number, d: number }>([A, B], [{ a: 'a', b: 'b' }, { c: 'c', d: 'd' }], [{}, {}])]
        expect(out).toEqual([
            {
                "a": 1,
                "b": 2,
                "c": 5,
                "d": 6,
            },
            {
                "a": 1,
                "b": 2,
                "c": 7,
                "d": 8,
            },
            {
                "a": 3,
                "b": 4,
                "c": 5,
                "d": 6,
            },
            {
                "a": 3,
                "b": 4,
                "c": 7,
                "d": 8,
            }
        ])
    })

    test.skip("Cross Product Variable Join (no common keys)", () => {
        const A = new datalog.Variable<{ a: number, b: number }>()
        const B = new datalog.Variable<{ c: number }>()

        A.assert({ a: 1, b: 2 })
        B.assert({ c: 3 })
        B.assert({ c: 4 })

        let out: Array<{ a: number, b: number, c: number }> = [...datalog.crossJoinVariables([A, B])]
        expect(out).toEqual([{ a: 1, b: 2, c: 3 }, { a: 1, b: 2, c: 4 }])
    })

})

describe("recursiveForLoopJoin", () => {
    const A = [{ a: 1, b: 2 }]
    const B = [{ b: 2, c: 3 }]
    const C = [{ a: 1, c: 3 }]

    // resultSoFar is an array of datums i.e.: [{a: 1, b: 2}, {b: 2, c: 3}]
    const mockJoinerHelper = function* (rels: Array<any>, resultSoFar: any): Generator<any> {
        if (rels.length === 0) {
            const allKeys = new Set(resultSoFar.map((datum: any) => Object.keys(datum)).flat())
            const keysPerDatum = resultSoFar.map((datum: any) => new Set(Object.keys(datum)))
            const commonKeys = [...allKeys].filter(k => keysPerDatum.every((s: any) => s.has(k)))
            const areCommonKeysTheSame = commonKeys.every((k: any) => {
                const s = new Set(resultSoFar.map((datum: any) => datum[k]))
                return s.size === 1
            })
            if (areCommonKeysTheSame) {
                yield resultSoFar.reduce((acc: any, o: any) => ({ ...acc, ...o }), {})
            }
        } else {
            const [head, ...tail] = rels
            for (let item of head) {
                yield* mockJoinerHelper(tail, resultSoFar.concat([item]))
            }
        }
    }


    const mockJoiner = function* (...rels: Array<any>) {
        yield* mockJoinerHelper(rels, [])
    }


    const mockRemapKeys = <T extends { [key: string]: any }>(rel: Array<T>, keyMap: { [key: string]: string }): Array<Partial<T> & { [key: string]: any }> => {
        return rel.map(datum => Object.keys(datum).reduce((acc, k) => {
            const newK = keyMap[k]
            if (newK) {
                acc[newK] = datum[k]
            }

            return acc
        }, {} as any))

    }


    test("Mock joiner works", () => {
        expect([...mockJoiner(A, B)]).toEqual([{ a: 1, b: 2, c: 3 }])
        expect([...mockJoiner(A, B, C)]).toEqual([{ a: 1, b: 2, c: 3 }]);
        {
            const C = [{ a: 1, c: 3 }, { a: 1, c: 4 }]
            expect([...mockJoiner(A, B, C)]).toEqual([{ a: 1, b: 2, c: 3 }, { a: 1, b: 2, c: 4 }])
        }
    })

    test("Mock remap keys works", () => {
        expect(mockRemapKeys(A, { a: 'a2', b: 'b' })).toEqual([{ a2: 1, b: 2 }])
    })
})

describe("Helpers", () => {
    test("Remap keys", () => {
        const inKeys = ["a", "b", "c", "d"]
        const mapping = { a: "a2", c: "c4", d: "d" }
        const out = datalog.remapKeys(inKeys, mapping)
        expect(out).toEqual(["a2", "b", "c4", "d"])
        expect(datalog.reverseRemapKeys(out, mapping)).toEqual(inKeys)
    })
})

describe("Query", () => {
    test("Hello World join", () => {
        const A = datalog.newTable<{ a: number, b: number }>()
        const B = datalog.newTable<{ b: number, c: number }>()
        A.assert({ a: 1, b: 2 })
        B.assert({ b: 2, c: 3 })

        const queryResult = datalog.query(({ a, b, c }: any) => {
            A({ a, b })
            B({ b, c })
        })
        expect([...queryResult.view().recentData()]).toEqual(intoAddedDatums([{ a: 1, b: 2, c: 3 }]))
    })

    test("People Example", () => {
        type ID = number
        const People = datalog.newTable<{ name: string, id: ID }>()
        const ParentOf = datalog.newTable<{ parentID: ID, childID: ID }>()

        let ids = 0

        People.assert({ name: "FooChild", id: ids++ })
        People.assert({ name: "FooDad", id: ids++ })
        People.assert({ name: "FooMom", id: ids++ })

        People.assert({ name: "BarChild", id: ids++ })
        People.assert({ name: "BarDad", id: ids++ })
        People.assert({ name: "BarMom", id: ids++ })

        ParentOf.assert({ parentID: 1, childID: 0 }) // 1 = FooDad, 0 = FooChild
        ParentOf.assert({ parentID: 2, childID: 0 }) // 2 = FooMom, 0 = FooChild

        ParentOf.assert({ parentID: 4, childID: 3 }) // 4 = BarDad, 3 = BarChild
        ParentOf.assert({ parentID: 5, childID: 3 }) // 5 = BarMom, 3 = BarChild

        // Find every parent
        let queryResult = datalog.query<{ parentName: string, parentID: number }>(({ parentName, parentID }) => {
            ParentOf({ parentID })
            People({ id: parentID, name: parentName })
        })

        expect([...queryResult.view().recentData()]).toEqual(intoAddedDatums([{ parentID: 1, parentName: "FooDad" }, { parentID: 2, parentName: "FooMom" }, { parentID: 4, parentName: "BarDad" }, { parentID: 5, parentName: "BarMom" }]))
    })

    test("People Example", () => {
        type ID = number
        const People = datalog.newTable<{ name: string, id: ID }>()
        const ParentOf = datalog.newTable<{ parentID: ID, childID: ID }>()

        let ids = 0

        People.assert({ name: "FooChild", id: ids++ })
        People.assert({ name: "FooDad", id: ids++ })
        People.assert({ name: "FooMom", id: ids++ })

        ParentOf.assert({ parentID: 1, childID: 0 }) // 1 = FooDad, 0 = FooChild
        ParentOf.assert({ parentID: 2, childID: 0 }) // 1 = FooMom, 0 = FooChild

        // Who's FooChild's parent?
        let queryResult = datalog.query<{ parentName: string, parentID: number }>(({ parentName, childID, parentID }: any) => {
            People({ name: "FooChild", id: childID })
            ParentOf({ childID, parentID })
            People({ id: parentID, name: parentName })
        })
        // Equivalent SQL query: (https://www.db-fiddle.com/f/t1TA5umdcoBuG8ZPcyMWTx/1)
        // select child.name as childName, ParentOf.childID, ParentOf.parentID, parent.name as parentName
        // from People child, People parent, ParentOf
        // where child.name = 'FooChild' and child.id = childID and parent.id = parentID


        expect([...queryResult.view().recentData()]).toEqual(intoAddedDatums([{ parentID: 1, parentName: "FooDad", childID: 0 }, { parentID: 2, parentName: "FooMom", childID: 0 }]))
    })

    test("People Example. Then query result", () => {
        type ID = number
        const People = datalog.newTable<{ name: string, id: ID }>()
        const ParentOf = datalog.newTable<{ parentID: ID, childID: ID }>()

        let ids = 0

        People.assert({ name: "FooChild", id: ids++ })
        People.assert({ name: "FooDad", id: ids++ })
        People.assert({ name: "FooMom", id: ids++ })

        ParentOf.assert({ parentID: 1, childID: 0 }) // 1 = FooDad, 0 = FooChild
        ParentOf.assert({ parentID: 2, childID: 0 }) // 1 = FooMom, 0 = FooChild

        // Who's FooChild's parent?
        let QueryResult = datalog.query<{ parentName: string, parentID: number }>(({ parentName, childID, parentID }: any) => {
            People({ name: "FooChild", id: childID })
            ParentOf({ childID, parentID })
            People({ id: parentID, name: parentName })
        })

        let QueryResult2 = datalog.query(({ parentID }: { parentID: number }) => {
            QueryResult({ parentName: "FooMom", parentID })
        })

        expect([...QueryResult2.view().recentData()]).toEqual(intoAddedDatums([{ parentID: 2 }]))
    })

    test("People Example 3 joins", () => {
        type ID = number
        const People = datalog.newTable<{ name: string, id: ID }>()
        const ParentOf = datalog.newTable<{ parentID: ID, childID: ID }>()
        const A = datalog.newTable<{ a: number, b: number }>()
        const B = datalog.newTable<{ b: number, c: number }>()

        let ids = 0

        People.assert({ name: "FooChild", id: ids++ })
        People.assert({ name: "FooDad", id: ids++ })
        People.assert({ name: "FooMom", id: ids++ })

        ParentOf.assert({ parentID: 1, childID: 0 }) // 1 = FooDad, 0 = FooChild
        ParentOf.assert({ parentID: 2, childID: 0 }) // 1 = FooMom, 0 = FooChild

        A.assert({ a: 1, b: 2 })
        B.assert({ b: 2, c: 3 })

        // Who's FooChild's parent?
        let queryResult = datalog.query<{ id: number, parentName: string, parentID: number, a: number, b: number, c: number }>(({ parentName, childID, parentID, a, b, c }: any) => {
            People({ name: "FooChild", id: childID })
            ParentOf({ childID, parentID })
            People({ id: parentID, name: parentName })
            A({ a, b })
            B({ b, c })
        })
        // Equivalent SQL query: (https://www.db-fiddle.com/f/t1TA5umdcoBuG8ZPcyMWTx/1)
        // select child.name as childName, ParentOf.childID, ParentOf.parentID, parent.name as parentName
        // from People child, People parent, ParentOf
        // where child.name = 'FooChild' and child.id = childID and parent.id = parentID

        // console.log("data", queryResult)
        const data = queryResult.view().recentData()

        expect(data).toEqual(intoAddedDatums([{ parentID: 1, parentName: "FooDad", childID: 0, a: 1, b: 2, c: 3 }, { parentID: 2, parentName: "FooMom", childID: 0, a: 1, b: 2, c: 3 }]))
    })

    test("Chain Queries", () => {
        type ID = number
        const People = datalog.newTable<{ name: string, id: ID }>()
        const ParentOf = datalog.newTable<{ parentID: ID, childID: ID }>()
        let ids = 0

        People.assert({ name: "FooChild", id: ids++ })
        People.assert({ name: "FooDad", id: ids++ })
        People.assert({ name: "FooMom", id: ids++ })
        People.assert({ name: "BarDad", id: ids++ })

        ParentOf.assert({ parentID: 1, childID: 0 }) // 1 = FooDad, 0 = FooChild
        ParentOf.assert({ parentID: 2, childID: 0 }) // 2 = FooMom, 0 = FooChild

        // Who are the children of FooMom?
        const QueryResult = datalog.query<{ childName: string, childID: number, parentID: number }>(({ childName, childID, parentID }) => {
            People({ name: "FooMom", id: parentID })
            ParentOf({ parentID, childID })
            People({ id: childID, name: childName, })
        })

        // console.log("data", queryResult)
        // Query the result
        let QueryView = QueryResult.view()
        expect(QueryView.recentData()).toEqual(intoAddedDatums([{ parentID: 2, childName: "FooChild", childID: 0 }]))

        // Who are the parents of these children?
        const QueryResult2 = datalog.query<{ childID: number, parentID: number, parentName: string }>(({ childID, parentID, parentName }) => {
            QueryResult({ childID })
            ParentOf({ childID, parentID })
            People({ id: parentID, name: parentName })
        })

        let QueryView2 = QueryResult2.view()
        expect(QueryView2.recentData()).toEqual(intoAddedDatums([{ parentID: 1, childID: 0, parentName: "FooDad" }, { parentID: 2, childID: 0, parentName: "FooMom" }]))

        // Now add new data to the Table and see how the queries change
        // Note that FooBrother's dad is BarDad
        // Foo and FooBrother are half brothers.
        People.assert({ name: "FooBrother", id: ids++ })
        ParentOf.assert({ parentID: 3, childID: ids - 1 }) // 1 = BarDad
        ParentOf.assert({ parentID: 2, childID: ids - 1 }) // 2 = FooMom

        // Run the second query again
        QueryResult2.runQuery()
        // Nothing new, because there's nothing new from the first QueryView.
        expect(QueryView2.recentData()).toEqual(null)

        // Run the first query again.
        // Note we are asking the query to run again. This is to prevent the case where a change in the Table will cause unnecessary work.
        // For example: If QueryView2 was offscreen, we wouldn't want to waste work updating it's state. Better to do that when necessary.
        QueryResult.runQuery()
        expect(QueryView.recentData()).toEqual(intoAddedDatums([{ parentID: 2, childName: "FooBrother", childID: 4 }]))

        // Now see the results of the second query
        // Note that FooMom appeared again. This is because the query runs on each child from QueryResult
        QueryResult2.runQuery()
        expect(QueryView2.recentData()).toEqual(intoAddedDatums([{ parentID: 2, childID: 4, parentName: "FooMom" }, { parentID: 3, childID: 4, parentName: "BarDad" }]))
    })

    test("Not Queries", () => {
        type ID = number
        const People = datalog.newTable<{ name: string, id: ID }>()
        const PeopleNeg = datalog.newTable<{ name: string, id: ID }>()
        const ParentOf = datalog.newTable<{ parentID: ID, childID: ID }>()
        let ids = 0

        People.assert({ name: "FooChild", id: ids++ })
        People.assert({ name: "FooDad", id: ids++ })
        People.assert({ name: "FooMom", id: ids++ })
        People.assert({ name: "BarDad", id: ids++ })
        PeopleNeg.assert({ name: "FooMom", id: 2 })

        ParentOf.assert({ parentID: 1, childID: 0 }) // 1 = FooDad, 0 = FooChild
        ParentOf.assert({ parentID: 2, childID: 0 }) // 2 = FooMom, 0 = FooChild

        // Who are the children of FooMom?
        const QueryResult = datalog.query<{ parentName: string, parentID: number }>(({ parentName, parentID }) => {
            People({ id: parentID, name: parentName })
            ParentOf({ parentID })
            People.not({ id: parentID, name: "FooMom" })
        })

        // // console.log("data", queryResult)
        // // Query the result
        let QueryView = QueryResult.view()
        let recentData = QueryView.recentData()
        expect(recentData?.filter(v => v.kind === datalog.Removed).length).toBe(0)

        expect(
            recentData?.map(v => v.datum).map(({ parentName }) => parentName)
        ).toEqual(["FooDad"])

        // // Who are the parents of these children?
        // const QueryResult2 = datalog.query<{ childID: number, parentID: number, parentName: string }>(({ childID, parentID, parentName }) => {
        //     QueryResult({ childID })
        //     ParentOf({ childID, parentID })
        //     // TODO it would be cool to use a not here. To not have Foo Mom appear
        //     People({ id: parentID, name: parentName })
        //     People.not({ id: parentID, name: "FooMom" })
        // })

        // let QueryView2 = QueryResult2.view()
        // expect(QueryView2.recentData()).toEqual([{ parentID: 1, childID: 0, parentName: "FooDad" }])

        // Now add new data to the Table and see how the queries change
        // Note that FooBrother's dad is BarDad
        // Foo and FooBrother are half brothers.
        // People.assert({ name: "FooBrother", id: ids++ })
        // ParentOf.assert({ parentID: 3, childID: ids - 1 }) // 1 = BarDad
        // ParentOf.assert({ parentID: 2, childID: ids - 1 }) // 2 = FooMom

        // // Run the second query again
        // QueryResult2.runQuery()
        // // Nothing new, because there's nothing new from the first QueryView.
        // expect(QueryView2.recentData()).toEqual(null)

        // Run the first query again.
        // Note we are asking the query to run again. This is to prevent the case where a change in the Table will cause unnecessary work.
        // For example: If QueryView2 was offscreen, we wouldn't want to waste work updating it's state. Better to do that when necessary.
        // QueryResult.runQuery()
        // expect(QueryView.recentData()).toEqual([{ parentID: 2, childName: "FooBrother", childID: 4 }])

        // // Now see the results of the second query
        // // Note that FooMom appeared again. This is because the query runs on each child from QueryResult
        // QueryResult2.runQuery()
        // expect(QueryView2.recentData()).toEqual([{ parentID: 2, childID: 4, parentName: "FooMom" }, { parentID: 3, childID: 4, parentName: "BarDad" }])
    })
})

describe("Retractions", () => {
    test("Datum Counts", () => {
        type ID = number
        const People = datalog.newTable<{ name: string, id: ID }>()
        let ids = 0

        People.assert({ name: "FooChild", id: ids++ })
        People.assert({ name: "FooDad", id: ids++ })

        // @ts-ignore
        const PeopleInnerVar: datalog.Variable<{ name: string, id: ID }> = People._innerVar

        expect(PeopleInnerVar.counts).toEqual(new Map([
            ["[[\"id\",0],[\"name\",\"FooChild\"]]", 1],
            ["[[\"id\",1],[\"name\",\"FooDad\"]]", 1]
        ]))

        People.assert({ name: "FooDad", id: 1 })
        expect(PeopleInnerVar.counts).toEqual(new Map([
            ["[[\"id\",0],[\"name\",\"FooChild\"]]", 1],
            ["[[\"id\",1],[\"name\",\"FooDad\"]]", 2]
        ]))

        People.retract({ name: "FooChild", id: 0 })
        expect(PeopleInnerVar.counts).toEqual(new Map([
            ["[[\"id\",0],[\"name\",\"FooChild\"]]", 0],
            ["[[\"id\",1],[\"name\",\"FooDad\"]]", 2]
        ]))
    })

    test("Relations get updated", () => {
        type ID = number
        const People = datalog.newTable<{ name: string, id: ID }>()
        let ids = 0

        People.assert({ name: "FooChild", id: ids++ })
        People.assert({ name: "FooDad", id: ids++ })

        // @ts-ignore
        const PeopleInnerVar: datalog.Variable<{ name: string, id: ID }> = People._innerVar

        while (PeopleInnerVar.changed()) { }

        expect(PeopleInnerVar.stable.relations[0].elements).toEqual([["FooChild", 0], ["FooDad", 1]])

        People.assert({ name: "FooDad", id: 1 })
        while (PeopleInnerVar.changed()) { }
        expect(PeopleInnerVar.stable.relations[0].elements).toEqual([["FooChild", 0], ["FooDad", 1]])

        People.retract({ name: "FooChild", id: 0 })
        while (PeopleInnerVar.changed()) { }
        expect(PeopleInnerVar.stable.relations[0].elements).toEqual([["FooDad", 1]])
    })

    test("Relations get updated", () => {
        type ID = number
        const People = datalog.newTable<{ name: string, id: ID }>()
        let ids = 0

        People.assert({ name: "FooChild", id: ids++ })
        People.assert({ name: "FooDad", id: ids++ })

        // @ts-ignore
        const PeopleInnerVar: datalog.Variable<{ name: string, id: ID }> = People._innerVar

        while (PeopleInnerVar.changed()) { }

        expect(PeopleInnerVar.stable.relations[0].elements).toEqual([["FooChild", 0], ["FooDad", 1]])

        People.assert({ name: "FooDad", id: 1 })
        while (PeopleInnerVar.changed()) { }
        expect(PeopleInnerVar.stable.relations[0].elements).toEqual([["FooChild", 0], ["FooDad", 1]])

        People.retract({ name: "FooChild", id: 0 })
        while (PeopleInnerVar.changed()) { }
        expect(PeopleInnerVar.stable.relations[0].elements).toEqual([["FooDad", 1]])
    })

    test("Retractions propagate through a join", () => {
        const A = datalog.newTable<{ a: number, b: number }>()
        const B = datalog.newTable<{ b: number, c: number }>()
        const C = datalog.newTable<{ a: number, c: number }>()
        A.assert({ a: 1, b: 2 })
        B.assert({ b: 2, c: 3 })
        B.assert({ b: 2, c: 4 })
        C.assert({ a: 1, c: 3 })
        C.assert({ a: 1, c: 4 })

        const QueryResult = datalog.query<{ a: number, b: number, c: number }>(({ a, b, c }) => {
            A({ a, b })
            B({ b, c })
            C({ a, c })
        })

        const QueryView = QueryResult.view()
        expect(QueryView.recentData()).toEqual(intoAddedDatums([
            {
                "a": 1,
                "b": 2,
                "c": 3,
            }, {
                "a": 1,
                "b": 2,
                "c": 4,
            }
        ]))
        C.retract({ a: 1, c: 3 })
        QueryResult.runQuery()
        let recent = QueryView.recentData()
        expect(recent).toEqual([
            {
                kind: datalog.Removed,
                datum: {
                    "a": 1,
                    "b": 2,
                    "c": 3,
                }
            }
        ])
    })
})