// What does this look like?


// { parent: PersonID, child: PersonID }
let parentOf = new Relation()
// { id: PersonID, name: String}
let person = new Relation()

person.assert({ id: 1, name: "Marco" })

// Returns an iterator of ids that match
datalog.findOnce((p) => {
    person({ id: p, name: "Marco" })
})
// => [[1]]

datalog.findOnce((parentName, p, m, x) => {
    person({ id: m, name: "Marco" })
    parentOf({ parent: p, child: m })
    person({ id: p, name: parentName })
})
// => [["Simona", 3, 1, ?], ["Enrique", 4, 1, ?]]

datalog.findOnce((p) => {
    const m = free()
    person({ id: m, name: "Marco" })
    parentOf({ parent: p, child: m })
})
// => [[3], [4]]

datalog.findOneOnce((parentName, p, _m) => {
    person({ id: _m, name: "Marco" })
    parentOf({ parent: _p, child: _m })
    person({ id: _p, name: parentName })
})
// => ["Simona", 3]

datalog.findOnce((name, _p) => {
    person({ id: _p, name: name })
}).orderBy(([name]) => [name])
// => ["Enrique", "Marco", "Simona"]

datalog.findOnce((name, _p) => {
    person({ id: _p, name: name })
}).orderBy(([name]) => [name])
// => ["Enrique", "Marco", "Simona"]

let sortedNamesStream = datalog.find((name, _p) => {
    person({ id: _p, name: name })
}).orderBy(([name]) => [name])

// Iterator the returns as new data comes in
sortedNamesStream.poll() // => true. There's new data here
sortedNamesStream.next()
// => ["insert", 0, ["Enrique", "Marco", "Simona"]]

sortedNamesStream.poll() // => False. nothing new

person.add({ id: 5, name: "Daiyi" })
sortedNamesStream.poll() // => True, something new
sortedNamesStream.next()
// => ["insert", 0, ["Daiyi"]]

person.retract({ name: "Marco" })
sortedNamesStream.poll() // => True, something new
sortedNamesStream.next()
// => ["remove", 2, 1] // Remove one item starting at index 2

// Listen for when there is new data. Note you won't get the data here, you'll have to call `.next()`
sortedNamesStream.subscribe(() => console.log("New data!"))

// View over the stream where things are upper case
let allCapsNameStream = sortedNamesStream.map(name => name.toUpperCase())

// Works the sampe as Array.reduce
let megaNameStream = sortedNamesStream.reduce((acc, name) => acc + name, "")

// Interesting versions
// mapDiff takes a diff and returns a diff. Use this to transform the array in powerful ways

// For example this reverses the order of the list without recomputing the sorting
let reverseNames = sortedNamesStream.mapDiffWithState((diff, state) => {
    switch (diff[0]) {
        case "insert":
            const index = diff[1]
            const items = diff[2]
            const revItems = items.reverse()
            const flippedIndex = state.length - index
            return [["insert", flippedIndex, revItems], { ...state, length: items.length + state.length }]
        case "remove":
            const index = diff[1]
            const flippedIndex = state.length - index
            const itemCount = diff[2]
            return [["remove", flippedIndex - itemCount, itemCount], { ...state, length: state.length - itemCount }]
    }
})

// Special case for reduce where the operation is commutative and associative
let hashedNames = sortedNamesStream.caReduce((totalHash, [diffType, name]) => {
    // diffType is either "insert" or "remove"
    // If insert, then we add the hashed name to our total hash via xor
    // If remove, then, by property of xor, we remove the hashed name to our total hash via xor
    return hash(name) ^ totalHash
}, 0)

// Hook it up to an HTML element
let rootElement = document.getElementById("root-container")
render(
    rootElement,
    sortedNamesStream.map(name => <p>{name}</p>)
)


// render – how it works:
// Pull based model

function renderChild(childRenders, childIdx) {
    const childRenderStream = childRenders[childIdx]
    while (true) {
        const { value: { noMoreDiffs }, done } = childRenderStream.next()
        if (done) {
            // remove childRender
            delete childRenders[childIdx]
        }
        if (noMoreDiffs) {
            break
        }
    }
}
function* render(rootElement, stream, notifyFn) {
    stream.addNotify(notifyFn)
    const childRenders = {} // map of idx to child render
    for (const [diff, meta] of stream) {
        if (meta.noMoreDiffs) {
            const { destroy } = yield { noMoreDiffs: true }
            if (destroy) {
                return
            }
        }

        switch (diff[0]) {
            case "insert":
                const [_, insertIdx, children] = diff
                const sibling = rootElement.childNodes[insertIdx]
                children.forEach(child => {
                    let childElement;
                    // If child is a stream we'll handle it differently
                    if (datalog.isStream(child, idx)) {
                        // render returns a dom element that will be managed by the datalog stream
                        // Recursively do something silimar: child.forEachDiff(...)
                        // Or equivalently (assuming stream of html)
                        childElement = document.createElement('div')
                        const childIdx = insertIdx + idx
                        const childNotifyFn = () => {
                            renderChild(childRenders, childIdx)
                        }
                        const childRenderStream = render(childElement, child, childNotifyFn)
                        childRenders[insertIdx + idx] = childRenderStream
                        return
                    } else {
                        childElement = child.toDOMElement()
                    }
                    rootElement.insertBefore(sibling, childHtml)
                })
                return _state
            case "remove":
                // TODO leak here with not closing stream?
                Object.keys(childRenders).forEach(childRenderIdx => {
                    if (renderIdx < childRenderIdx < renderIdx + amountToRemove) {
                        delete childRenders[childRenderIdx]
                    }
                })

                const [_, removeIdx, amountToRemove] = diff
                rootElement.remove()
                for (let removedSoFar = 0; removedSoFar < amountToRemove; removedSoFar++) {
                    const child = rootElement.childNodes[removeIdx]
                    rootElement.removeChild(child)
                }
                return _state
        }

        // Handle children renders
        Object.keys(childRenders).forEach(childIdx => renderChild(childRenders, childIdx))
    }
}


// Connected node discovery example
// { from: NodeID, to: NodeID }
let edges = new Relation()
// { id: NodeID }
let nodes = new Relation()

// Expand the relation of nodes to include all nodes transitively connected to the nodes originally in the set
datalog.rule((fromNode, toNode) => {
    edges({ from: fromNode, to: toNode })
    nodes({ id: fromNode })
}).implies((fromNode, toNode) => {
    nodes({ id: toNode })
})
// Updates nodes to react to edges/nodes


// Twitter example

// { msgID: MessageID, content: String }
let messages = new Relation()

// { msgID: MessageID, author: PersonID }
let msgAuthor = new Relation()

// { person: PersonID, likes: MessageID }
let msgLikes = new Relation()

// { id: PersonID, name: String}
let person = new Relation()

let chat = datalog.find((msgID, content, author, authorName) => {
    messages({ msgID, content })
    msgAuthor({ msgID, author })
    person({ id: author, name: authorName })
})
    .orderBy((msgID) => [msgID])
    .map((msgID) => {
        const likes = datalog.find((person) => { msgLikes({ msgID, person }) })

        // caReduce is a special case of reduce that has commutative & associative properties
        const likeCount = likes.caReduce((count, [diffType, person]) => diffType === "insert" ? count + 1 : count - 1, 0)
        return [...info, likesStream]
    })


// Now render the messages to the dom

render(
    rootElement,
    chat.map((msgID, content, _author, authorName, likes, likeCount) => {
        return (
            <div data-msg-id={msgID}>
                <p>{content}</p>
                <p>posted by: {authorName}</p>
                {likeCount.map(count => <p>{count === 1 ? "One person likes this" : `${count} people like this`}</p>)}
            </div>
        )
    })
)