import * as datalog from './datalog'

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
        C.assert({ a: 1, c: 3 })

        const out: Array<[number, number, number]> = []
        datalog.leapJoinHelper(A, [B.extendWith(([_, b]) => b)], ([a, b], [c]) => {
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
        datalog.leapJoinHelper(A, [B.extendWith(([_, b]) => b)], ([a, b], [c]) => {
            out.push([a, b, c])

        })

        expect(out).toEqual([[1, 2, 3], [1, 2, 4]])
    });

    // test('Propose returns the item added', () => {
    //     // { id: PersonID, name: String}
    //     const person = datalog.Relation<{ id: PersonID, name: string }>()
    //     person.assert({ id: 0, name: "marcopolo" })
    //     expect(person.propose({})).toEqual([{ id: 0, name: "marcopolo" }]);
    // });

    // test('Reindex works as expected', () => {
    //     // { id: PersonID, name: String}
    //     const person = datalog.Relation<{ id: PersonID, name: string }>()
    //     person.assert({ id: 0, name: "marcopolo" })
    //     person.indexBy("name")
    //     // @ts-check
    //     expect(person._thiz.indices["name$id"].elements).toEqual([["marcopolo", 0]]);
    // });

    // test('No data returns empty free vars', () => {
    //     // { id: PersonID, name: String}
    //     const person = datalog.Relation<{ id: PersonID, name: string }>()
    //     const freeVar = new datalog.FreeVariable<PersonID>()

    //     // person({ id: freeVar })
    //     // expect(freeVar.availableValues).toEqual([]);
    // });

    // test('One datum shows up in free vars', () => {
    //     // { id: PersonID, name: String}
    //     const person = datalog.Relation<{ id: PersonID, name: string }>()
    //     person.assert({ id: 0, name: "marcopolo" })

    //     const freeVar = new datalog.FreeVariable<PersonID>()

    //     // person({ id: freeVar })
    //     // expect(freeVar.availableValues).toEqual([0]);
    // });

    // test('Data shows up in free vars', () => {
    //     // { id: PersonID, name: String}
    //     const person = datalog.Relation<{ id: PersonID, name: string }>()
    //     person.assert({ id: 0, name: "marcopolo" })
    //     person.assert({ id: 1, name: "daiyi" })

    //     const freeVar = new datalog.FreeVariable<PersonID>()

    //     // person({ id: freeVar })
    //     // expect(freeVar.availableValues).toEqual([0, 1]);
    // });

    // test('Data shows up in free vars many Free vars', () => {
    //     // { id: PersonID, name: String}
    //     const person = datalog.Relation<{ id: PersonID, name: string }>()
    //     person.assert({ id: 0, name: "marcopolo" })
    //     person.assert({ id: 1, name: "daiyi" })

    //     const freeVar = new datalog.FreeVariable<PersonID>()
    //     const name = new datalog.FreeVariable<string>()

    //     // person({ id: freeVar, name: "marcopolo" })
    //     // expect(freeVar.availableValues).toEqual([0, 1]);
    // });
})