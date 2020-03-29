import traverse from '@babel/traverse'
import * as parser from '@babel/parser'

function planQuery(source: any) {
    const requires = new Set();

    let ast;
    ast = parser.parse("require('foo')");
    return ast

    // traverse(ast, {
    //     CallExpression: (path) => {
    //         if (!path || !path.node || !path.node.callee || path.node.callee.name !== "require") {
    //             return;
    //         }

    //         const arg = path && path.node && path.node.arguments && path.node.arguments[0];
    //         if (!arg) {
    //             return;
    //         }

    //         let packageName;
    //         if (arg.type === "StringLiteral") {
    //             packageName = arg.value;
    //         } else if (arg.type === "TemplateLiteral" && arg.quasis &&
    //             arg.quasis.length === 1 && arg.quasis[0].value) {
    //             packageName = arg.quasis[0].value.cooked;
    //         }

    //         if (packageName && !packageName.startsWith("..") && !packageName.startsWith("./")) {
    //             requires.add(packageName);
    //         }
    //     }
    // });

    // return requires;
}


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