/*

// { parent: PersonID, child: PersonID }
// let parentOf = new Relation()
let parentOf = (a: any) => { }
// // { id: PersonID, name: String}
// let person = new Relation()
let person = (a: any) => { }

// person.assert({ id: 1, name: "Marco" })

const datalog = {
    findOnce: (f: any) => { }
}

// Returns an iterator of ids that match
datalog.findOnce((p) => {
    person({ id: p, name: "Marco" })
})
// => [[1]]

const q = (parentName, p, m) => {
    person({ id: m, name: "Marco" })
    parentOf({ parent: p, child: m })
    person({ id: p, name: parentName })
}

// should be

() => {
    const out = []
    for (const m of person({ name: "marco" }).intersect(parentOf)) {
        for (const p of parentOf({ child: m }).intersect(person)) {
            for (const parentName of person({ id: p }) {
                out.push([parentName, p, m])
            }
        }
    }
    return out
}



(a, b, c) => {
    A({ a, b });
    B({ b, c });
    C({ c, a });
    X({ x });
}

(parentName, p, m) => {
    person({
        id: m,
        name: "Marco"
    });
    person({
        id: p,
        name: parentName
    });
    parentOf({
        parent: p,
        child: m
    });
}


() => {
    const out = []
    for (const { id: m } of person({ name: "marco" })) {
        for (const { id: p, name: parentName } of person({}).intersect(parentOf({ child: m })) {
            out.push([parentName, p, m])
        }
    }
    return out
}


console.log('hiii', planQuery(q.toString()), q.toString())
// console.log('hiii', q.toString())

*/