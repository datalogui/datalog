import * as datalog from './datalog'

type PersonID = number

describe('Free Variable', () => {
    test('Constrains', () => {
        // { id: PersonID, name: String}
        const person = datalog.Relation<{ id: PersonID, name: string }>()
        const v = new datalog.FreeVariable()
        v.constrain([1, 2, 3, 4])
        expect(v.availableValues).toStrictEqual([1, 2, 3, 4]);
        v.constrain([2, 3])
        expect(v.availableValues).toStrictEqual([2, 3]);
    });
})

describe('Relation', () => {
    test('Returns a function', () => {
        // { id: PersonID, name: String}
        const person = datalog.Relation<{ id: PersonID, name: string }>()

        expect(typeof person).toBe("function");
    });

    test('Returns a function', () => {
        // { id: PersonID, name: String}
        const person = datalog.Relation<{ id: PersonID, name: string }>()

        expect(typeof person).toBe("function");
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