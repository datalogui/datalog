// @ts-ignore
import * as DataFrog from 'datafrog-js'
type FindExpression = (<A>(a: A) => {}) | (<A, B>(a: A, b: B) => {}) | (<A, B, C>(a: A, b: B, c: C) => {}) | (<A, B, C, D>(a: A, b: B, c: C, d: D) => {})

function find(findExpression: FindExpression): any {
}

type FreeVariableObj<Val extends {}> = { [key: string]: FreeVariable<Val[keyof Val]> | Val[keyof Val] }

// For each query there is a collection of relations and free variableObjs on them
class DatalogContext<Val> {
    context: Array<[MultiIndexRelation<Val>, FreeVariableObj<Val>]> = []
    queryPlan() {
        // TODO speed this up
        // Hacky for now. join everything, then filter

        // Build our join groups
        let joinsByKey: {
            [key: string]: Array<MultiIndexRelation<Val>>
        } = {}
        for (let index = 0; index < this.context.length; index++) {
            const [currentRelation] = this.context[index]
            const ks = currentRelation.keys()
            const keyToJoinBy = ks.find(k => !!joinsByKey[k as string])
            // No key in our join set. let's add a new one
            if (keyToJoinBy === undefined) {
                joinsByKey[ks[0] as string] = [currentRelation]
            }
        }

        // Now that we have the groups we are going to join by, let's join each group. Then try the above again until we end up with a single group.
        // TODO



    }
}

class DatalogContextManager<Val> {
    ctxs: Array<DatalogContext<Val>> = []
    add(part: [MultiIndexRelation<Val>, FreeVariableObj<Val>]) {
        if (this.ctxs.length === 0) {
            throw new Error("Ctx not initialized!")
        }

        this.ctxs[this.ctxs.length - 1].context.push(part)
    }


    pushCtx() {
        this.ctxs.push(new DatalogContext())
    }

    popCtx(): DatalogContext<Val> {
        const ctx = this.ctxs.pop(); if (ctx === undefined) {
            throw new Error("No context to pop")
        } return ctx
    }
}

const datalogContextManager = new DatalogContextManager()

// Represents any possible value of T, can be constrained.
export class FreeVariable<T> {
    // Null means it is unconstrained(!)
    availableValues: Array<T> | null = null
    isUnconstrained(): boolean {
        return this.availableValues === null
    }
    constrain(values: Array<T>) {
        if (this.availableValues === null) {
            this.availableValues = values
        }

        let valuesIdx = 0;
        this.availableValues.filter((availVals) => {
        })

        const output: Array<T> = []
        // TODO speed this puppy up!
        this.availableValues.map(availValue => {
            values.map(constrainValue => {
                if (constrainValue === availValue) {
                    output.push(constrainValue)
                }
            })
        })

        this.availableValues = output
    }
}

interface Leaper<P, Val> {
    <K extends keyof Val>(freeVariableObj: { [key: string]: FreeVariable<Val[K]> }): void;
    count: (prefix: P) => number
    propose: (prefix: P) => Array<Val>
    // Could be faster if we mutate vals
    intersect: (prefix: P, vals: Array<Val>) => Array<Val>
}

interface Tell<Val> {
    assert: (v: Val) => void
    retract: (v: Val) => void
}

interface MultiIndexRelation<Val> {
    keys: () => Array<keyof Val>
    isIndexedBy: (k: keyof Val) => boolean
    indexBy: (k: keyof Val) => void
}


function findOnce(findExpression: FindExpression) {
    const argumentLength = findExpression.length
    const freeVars = new Array(argumentLength).fill(0).map(i => new FreeVariable())
    // @ts-ignore
    findExpression(...freeVars)
    const out = []
    for (let i = 0; i < freeVars.length; i++) {
        for (let j = i; j < freeVars.length; j++) {
        }
        const freeVar = freeVars[i];
    }
}

export function figureOutHowManyFreevar(findExpression: FindExpression) {
    findExpression
}

// interface ThisRelation {
//     indices: { [idxOrder: string]: DataFrog.Relation }
//     firstIdx: string | null
// }

// type ValueOf<T> = T[keyof T];

// export function Relation<T>(): Leaper<{}, T> & Tell<T> & MultiIndexRelation<T> {
//     const thiz: ThisRelation = {
//         indices: {},
//         firstIdx: null
//     }


//     const relation = function (freeVariableObj: FreeVariableObj<T>) {
//         // @ts-ignore
//         // datalogContextManager.add([thiz, freeVariableObj])

//         // // Constrain the free variable
//         // Object.keys(freeVariableObj).map((freeVariableName: string) => {
//         //     // filter out fixed vars
//         //     const freeVariable = freeVariableObj[freeVariableName]
//         //     if (freeVariable instanceof FreeVariable) {
//         //         freeVariable.constrain(relation.propose({}).map((rowObj: T) => {
//         //             // @ts-ignore
//         //             return rowObj[freeVariableName]
//         //         }))
//         //     }
//         // })
//     }

//     // @ts-ignore
//     // relation = relation.bind(thiz)



//     relation.count = function (_: {}): number { return thiz.firstIdx === null ? 0 : thiz.indices[thiz.firstIdx].length }
//     // Find the best idx for this
//     relation.propose = function (_: {}): Array<T> {
//         if (thiz.firstIdx === null) {
//             return []
//         }


//         const ks = thiz.firstIdx.split("$")
//         return thiz.indices[thiz.firstIdx].elements.map((row: Array<ValueOf<T>>) => {
//             // @ts-ignore
//             let out: T = {}
//             for (let index = 0; index < row.length; index++) {
//                 // @ts-ignore
//                 out[ks[index]] = row[index];
//             }
//             return out
//         })
//     }
//     // Find the best idx for this
//     relation.intersect = function (_: {}, vals: Array<T>): Array<T> {
//         const firstIdx = thiz.firstIdx
//         if (firstIdx === null) {
//             return []
//         }


//         // @ts-ignore
//         const ks: Array<keyof T> = firstIdx.split("$")
//         return vals.filter((val: T) => {
//             // Do I have thiz in my relation?
//             return thiz.indices[firstIdx].some((row: Array<ValueOf<T>>) => {
//                 return ks.every((k, idx) => {
//                     val[k] === row[idx]
//                 })
//             })
//         })

//     }

//     relation.assert = function (obj: T) {
//         // @ts-ignore
//         const ks: Array<keyof T> = Object.keys(obj)
//         if (thiz.firstIdx === null) {
//             thiz.firstIdx = ks.join('$')
//             const relation = new DataFrog.Relation([ks.map(k => obj[k])])
//             thiz.indices[thiz.firstIdx] = new DataFrog.Relation([])
//         }

//         const relation = new DataFrog.Relation([ks.map(k => obj[k])])
//         thiz.indices[thiz.firstIdx] = thiz.indices[thiz.firstIdx].merge(relation)
//     }

//     relation.retract = function () {
//         throw new Error("UNIMPLEMENTED")
//     }

//     relation.keys = function (): Array<keyof T> {
//         if (thiz.firstIdx === null) {
//             throw new Error("Relation not initialized")
//         }

//         return thiz.firstIdx.split("$")
//     }

//     relation.isIndexedBy = function (k: keyof T): boolean {
//         return Object.keys(thiz.indices).some(v => v.startsWith(k.toString()))
//     }

//     relation.indexFor = function (ks: Array<keyof T>): DataFrog.Relation {
//         return thiz.indices[ks.join("$")]
//     }

//     relation.indexBy = function (k: keyof T) {
//         if (relation.isIndexedBy(k)) {
//             return
//         }

//         const ks = relation.keys()
//         const indexedRelation = relation.indexFor(ks)
//         // Could probably make this faster
//         // const newKsSet = new Set([k])
//         const newKs = [k]
//         const newMapping = ks.reduce((acc, oldK, i) => {
//             if (k === oldK) {
//                 return { ...acc, [i]: 0 }
//             }
//             newKs.push(oldK)

//             return { ...acc, [i]: newKs.length - 1 }

//         }, {})

//         const reIndexed = indexedRelation.elements.map((row: any) => {
//             const out = []
//             row.map((col: any, idx: number) => {
//                 // @ts-ignore
//                 out[newMapping[idx]] = col
//             })
//             // @ts-ignore
//             return out
//         })

//         thiz.indices[newKs.join('$')] = new DataFrog.Relation(reIndexed)
//     }

//     relation._thiz = thiz

//     return relation
// }