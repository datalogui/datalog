// @ts-ignore
import * as DataFrog from 'datafrog-js'

type ValueOf<T> = T[keyof T];

type Tupleized<T> = Array<ValueOf<T>>

// type Tupleized<K, Val> = [K, ...Array<ValueOf<Val>>]

interface Leaper<P, V> {
    count: (prefix: P) => number
    propose: (prefix: P) => Array<V>
    // Could be faster if we mutate vals
    intersect: (prefix: P, vals: Array<V>) => Array<V>
}

// type ExtendWith = {
//     keyFunc: (P: P) => K
//     relation: RelationIndex<KName, K, Val>
// }

class ExtendWith<P, KName, K, Val> implements Leaper<P, Tupleized<Val>> {
    keyFunc: (P: P) => K
    relation: RelationIndex<KName, K, Val>

    startIdx: number = 0
    endIdx: number = 0

    constructor(keyFunc: (P: P) => K, relation: RelationIndex<KName, K, Val>) {
        this.keyFunc = keyFunc
        this.relation = relation
    }

    count(prefix: P): number {
        const key = this.keyFunc(prefix)
        this.startIdx = DataFrog.gallop(this.relation.elements, (row: any) => DataFrog.sortTuple(row[0], key) === -1)
        this.endIdx = DataFrog.gallop(this.relation.elements, (row: any) => DataFrog.sortTuple(row[0], key) !== 0, this.startIdx + 1)
        return this.endIdx - this.startIdx
    }

    propose(prefix: P): Array<Tupleized<Val>> {
        return this.relation.elements.slice(this.startIdx, this.endIdx).map(([_, ...rest]) => rest)
    }

    // Could be faster if we mutate vals
    intersect(prefix: P, vals: Array<Tupleized<Val>>): Array<Tupleized<Val>> {
        const key = this.keyFunc(prefix)
        let startIdx = this.startIdx;
        return vals.filter(val => {
            startIdx = DataFrog.gallop(this.relation.elements, ([_, ...rest]: any) => DataFrog.sortTuple(rest, val) === -1)
            if (startIdx >= this.relation.elements.length) {
                return false
            }

            return DataFrog.sortTuple(this.relation.elements[startIdx]?.slice(1), val) === 0
        })
    }
}

export class RelationIndex<KName, K, Val> {
    // Array of tuples
    elements: Array<[K, ...Array<ValueOf<Val>>]>
    keyOrdering: [KName, ...Array<keyof Val>]

    constructor(elements: Array<[K, ...Array<ValueOf<Val>>]>, keyOrdering: [KName, ...Array<keyof Val>]) {
        this.elements = elements
        this.keyOrdering = keyOrdering
    }

    indexBy<NewKName extends keyof Val | KName, NewK extends ValueOf<Val> | K, NewVal extends ValueOf<Val> | K>(newkeyOrdering: [NewKName, ...Array<keyof NewVal>]): RelationIndex<NewKName, NewK, NewVal> {
        const keyMapping = this.keyOrdering.reduce((acc: { [key: string]: number }, k, idx) => {
            acc[k as string] = idx
            return acc
        }, {})

        const newData = this.elements.map(row => newkeyOrdering.map(k => row[keyMapping[k as string]])) as Array<[NewK, ...Array<ValueOf<NewVal>>]>
        return new RelationIndex(newData, newkeyOrdering)
    }

    assert(element: any /*{[KName]: K} & Val*/) {
        // @ts-ignore
        this.insertRow(this.keyOrdering.map(k => element[k]))
    }

    insertRow(newRow: [K, ...Array<ValueOf<Val>>]) {
        const insertIdx = DataFrog.gallop(this.elements, (row: any) => DataFrog.sortTuple(row, newRow) === -1)
        this.elements.splice(insertIdx, 0, newRow)
    }

    extendWith<P>(keyFunc: (prefix: P) => K): ExtendWith<P, KName, K, Val> {
        return new ExtendWith(keyFunc, this)
    }

    // indexError(prefix: Partial<T>) {
    //     const key = prefix[this.keyOrdering[0]]
    //     throw new Error(`Relation is not indexed properly! Expected to by indexed by ${key}, but was only given ${Object.keys(prefix)}`)
    // }

    // Rough heuristic for now, could be better?
    // count(prefix: Partial<>): number {
    //     return this.elements.length
    // }
    // propose(prefix: Partial<T>): Array<Tupleized<T>> {
    //     const key = prefix[this.keyOrdering[0]]
    //     if (!key) {
    //         this.indexError(prefix)
    //         return []
    //     }

    //     const out = []
    //     const startIdx = DataFrog.gallop(this.elements, (row: Array<ValueOf<T>>) => DataFrog.sortTuple(row[0], key) === -1)
    //     const endIdx = DataFrog.gallop(this.elements, (row: Array<ValueOf<T>>) => DataFrog.sortTuple(row[0], key) !== -1, startIdx)
    //     for (let index = startIdx; index < endIdx; index++) {
    //         out.push(this.elements[index])
    //     }
    //     return []
    // }

    // // Could be faster if we mutate vals
    // intersect(prefix: Partial<T>, vals: Array<Tupleized<T>>): Array<Tupleized<T>> {
    //     const key = prefix[this.keyOrdering[0]]
    //     if (!key) {
    //         this.indexError(prefix)
    //         return []
    //     }
    //     const out = []
    //     let i = 0
    //     let j = 0
    //     while (i < vals.length && j < vals.length) {
    //         const rowA = vals[i]
    //         const rowB = this.elements[j]
    //         if (DataFrog.sortTuple(rowA, rowB) === -1) {
    //             // Advance A
    //         if (DataFrog.sortTuple(rowA, rowB) === 1) {
    //             // Advance B
    //         } else {
    //             // Same
    //             i++
    //             j++
    //             out.push(rowA)
    //         }

    //     }

    //     return []
    // }
}


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


// class Relation<T> {
//     // Array of tuples
//     indices: { [key: string]: RelationIndex<T> } = {}
//     firstKey: string | null = null
//     constraint: Partial<T> = {}

//     keyForIndex(key: Array<keyof T>): string {
//         return key.join('$')
//     }

//     indexFor(key: Array<keyof T>) {
//         if (this.firstKey === null) {
//             throw new Error("No data")
//         }
//         const k = this.keyForIndex(key)
//         if (this.indices[k]) {
//             return this.indices[k]
//         }

//         const newIndex = this.indices[this.firstKey].indexBy(key)
//         this.indices[k] = newIndex
//         return newIndex
//     }

//     assert(datum: T) {
//         Object.values(this.indices).forEach(relationIndex => {
//             relationIndex.assert(datum)
//         })
//     }

//     next() {
//         return { done: true }
//     }
// }

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