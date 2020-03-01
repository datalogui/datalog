
type FindExpression = (<A>(a: A) => {}) | (<A, B>(a: A, b: B) => {})

function findOnce(findExpression: FindExpression): any {
}

export function sum(a, b) {
    return a + b
}