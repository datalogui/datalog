// An implementation of https://github.com/rust-lang/datafrog
const sortTuple = (a, b) => {
  if (a === Unconstrained || b === Unconstrained) {
    return true
  }

  if (typeof a !== "object" && typeof b !== "object") {
    return a < b ? -1 : a === b ? 0 : 1
  }

  if (a.length != b.length) {
    throw new Error(
      'Can\'t sort different sized tuples. Tuples are not the same length:',
      a, b)
  }
  for (let index = 0; index < a.length; index++) {
    const elementA = a[index];
    const elementB = b[index];

    if (elementA === Unconstrained || elementB === Unconstrained) {
      continue
    }

    if (elementA === elementB) {
      continue
    }

    if (Array.isArray(elementA)) {
      return sortTuple(elementA, elementB)
    }

    if (typeof elementA == 'string') {
      return elementA < elementB ? -1 : 1
    }

    return elementA < elementB ? -1 : 1
  }

  return 0
};

// Mutates the input array!
// See https://doc.rust-lang.org/1.40.0/src/core/slice/mod.rs.html#1891 for a
// great explanation of this algorithm.
// Basically we bubble duplicates to the end of the array, then split the array
// to before dupes and after dupes. O(n)
// If the array is sorted, this will remove all duplicates.
// comparatorFn should return true if the items are the same.
function dedupBy(array, comparatorFn) {
  let w = 1
  for (let r = 1; r < array.length; r++) {
    const rElement = array[r];
    const wElementPrev = array[w - 1];
    if (comparatorFn(rElement, wElementPrev)) {
      // The same so we keep `w` where it is
    } else {
      // We need to swap the elements
      // But only swap if their indices are different (otherwise it's no-op)
      if (r !== w) {
        array[r] = array[w]
        array[w] = rElement
      }
      w++
    }
  }
  array.splice(w)
}

// A sorted list of distinct tuples.
class Relation {
  constructor(fromArray, sortFn = sortTuple) {
    this.sortFn = sortFn;
    const sorted = fromArray.sort(sortFn)
    // _.uniqWith is 1000x slower
    dedupBy(sorted, (a, b) => sortFn(a, b) === 0)
    this.elements = sorted
  }

  merge(otherRelation) {
    if (otherRelation.sortFn !== this.sortFn) {
      throw new Error('Merging a relation that doesn\'t have the same sortFn!');
    }

    return new Relation(
      this.elements.concat(otherRelation.elements), this.sortFn);
  }

  get length() {
    return this.elements.length;
  }
}

class Variable {
  constructor() {
    // A list of already processed tuples.
    this.stable = [];
    // Recently added but unprocessed tuples.
    this.recent = new Relation([]);
    // A list of tuples yet to be introduced.
    this.toAdd = [];
  }

  insert(relation) {
    this.toAdd.push(relation);
  }

  fromJoin(otherVariable, logicFn) {
    joinInto(this, otherVariable, this, logicFn);
  }

  toString() {
    return JSON.stringify({
      stable: this.stable.length ?
        this.stable.reduce((acc, relation) => acc.merge(relation)).elements :
        [],
      recent: this.recent.elements,
      toAdd: this.toAdd.length ?
        this.toAdd.reduce((acc, relation) => acc.merge(relation)).elements :
        [],
    })
  }

  changed() {
    // 1. Merge this.recent into this.stable.
    if (this.recent.elements.length > 0) {
      let recent = this.recent;
      this.recent = new Relation([], recent.sortFn);

      // TODO visualize this!
      // Merge smaller stable relations into our recent one. This keeps bigger
      // relations to the left, and smaller relations to the right. merging them
      // over time so not to keep a bunch of small relations.
      while (this.stable[this.stable.length - 1] &&
        this.stable[this.stable.length - 1].length <=
        2 * recent.elements.length) {
        const last = this.stable.pop();
        recent = last.merge(recent);
      }

      this.stable.push(recent);
    }

    // 2. Move this.toAdd into this.recent.
    if (this.toAdd.length > 0) {
      // 2a. Restrict `toAdd` to tuples not in `this.stable`.
      for (let toAddIndex = 0; toAddIndex < this.toAdd.length; toAddIndex++) {
        const toAdd = this.toAdd[toAddIndex]
        for (let index = 0; index < this.stable.length; index++) {
          const stableRelation = this.stable[index];
          toAdd.elements = toAdd.elements.filter(elem => {
            let searchIdx = gallop(
              stableRelation.elements,
              (tuple) => stableRelation.sortFn(tuple, elem) < 0);
            if (searchIdx < stableRelation.elements.length &&
              stableRelation.sortFn(
                stableRelation.elements[searchIdx], elem) === 0) {
              return false
            }

            return true;
          });
        }
      }

      // 2b. Merge all newly added relations.
      let toAdd = this.toAdd.pop();
      while (this.toAdd.length > 0) {
        toAdd = toAdd.merge(this.toAdd.pop());
      }

      this.recent = toAdd;
    }

    // Return true iff recent is non-empty.
    return !!this.recent.length;
  }
}

// Finds the first index for which predicate is false. Returns an index of
// array.length if it will never be false
// predFn takes the form of (tuple) => boolean
function gallop(array, predFn, startIdx = 0) {
  if (array.length - startIdx <= 0 || !predFn(array[startIdx])) {
    return startIdx;
  }

  let step = 1;

  // Step up until we've seen a false result from predFn
  while (startIdx + step < array.length && predFn(array[startIdx + step])) {
    startIdx += step;
    step = step << 1;
  }

  // Now step down until we get a false result
  step = step >> 1;
  while (step > 0) {
    if (startIdx + step < array.length && predFn(array[startIdx + step])) {
      startIdx += step;
    }
    step = step >> 1;
  }

  return startIdx + 1;
}

// logicFn takes the form of (key, val1, val2)
// relations should be a sorted set of (K, V) tuples, sorted by key.
// we join on the first item in the tuple.
function joinHelper(relationA, relationB, logicFn) {
  // Keep track of the indices into the relation's elements
  let idxA = 0;
  let idxB = 0;
  while (idxA < relationA.elements.length && idxB < relationB.elements.length) {
    let elemA = relationA.elements[idxA];
    let elemB = relationB.elements[idxB];
    let elemAKey = relationA.elements[idxA][0];
    let elemBKey = relationB.elements[idxB][0];

    if (elemAKey < elemBKey, sortTuple(elemA, elemB) === -1) {
      // We have to move idxA up to catch to elemB
      idxA = gallop(
        relationA.elements, (row) => sortTuple(row, elemB) === -1, idxA);
    } else if (sortTuple(elemA, elemB) === 1) {
      // We have to move idxB up to catch to elemA
      idxB = gallop(
        relationB.elements, (row) => sortTuple(row, elemA) === -1, idxB);
    } else {
      // They're equal. We have our join

      // Figure out the count of matches in each relation
      let matchingCountA = 0
      while (idxA + matchingCountA < relationA.elements.length &&
        relationA.elements[idxA + matchingCountA][0] === elemAKey) {
        matchingCountA++
      }
      let matchingCountB = 0
      while (idxB + matchingCountB < relationB.elements.length &&
        relationB.elements[idxB + matchingCountB][0] === elemAKey) {
        matchingCountB++
      }

      // Call logicFn on the cross product
      for (let i = 0; i < matchingCountA; i++) {
        for (let j = 0; j < matchingCountB; j++) {
          logicFn(
            elemAKey, relationA.elements[idxA + i],
            relationB.elements[idxB + j]);
        }
      }

      idxA += matchingCountA;
      idxB += matchingCountB;
    }
  }
}

// logicFn is of the type: (Key, ValA, ValB) => Result
// where Result is the type of data that will live in outputVariable.
// To join these two variables we have to join 3 things.
// inputVariableA.recent – inputVariableB.stable
// inputVariableA.stable – inputVariableB.recent
// inputVariableA.recent – inputVariableB.recent
function joinInto(inputVariableA, inputVariableB, outputVariable, logicFn) {
  const results = [];

  // inputVariableA.recent – inputVariableB.stable
  for (let index = 0; index < inputVariableB.stable.length; index++) {
    const stableRelation = inputVariableB.stable[index];
    joinHelper(
      inputVariableA.recent, stableRelation,
      (k, [_, vA], [__, vB]) => results.push(logicFn(k, vA, vB)));
  }
  // inputVariableA.stable – inputVariableB.recent
  for (let index = 0; index < inputVariableA.stable.length; index++) {
    const stableRelation = inputVariableA.stable[index];
    joinHelper(
      stableRelation, inputVariableB.recent,
      (k, [_, vA], [__, vB]) => results.push(logicFn(k, vA, vB)));
  }

  // inputVariableA.recent – inputVariableB.recent
  joinHelper(
    inputVariableA.recent, inputVariableB.recent,
    (k, [_, vA], [__, vB]) => results.push(logicFn(k, vA, vB)));

  outputVariable.insert(new Relation(results));
}

export const Unconstrained = Symbol('Unconstrained')

module.exports = {
  Relation,
  Variable,
  gallop,
  joinHelper,
  dedupBy,
  sortTuple,
  Unconstrained
};
