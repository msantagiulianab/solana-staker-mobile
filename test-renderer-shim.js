/**
 * Polyfill for react-test-renderer@19 providing the createRoot() API
 * expected by @testing-library/react-native v14.
 */
'use strict'

const renderer = require('react-test-renderer')

if (!renderer.createRoot) {
  function walkTree(node, predicate, options = {}) {
    const results = []
    const { matchDeepestOnly } = options

    if (!node) return results
    // Skip string/text nodes — they aren't valid query targets
    if (typeof node === 'string') return results

    // Check this node
    if (predicate(node)) {
      results.push(node)
      if (matchDeepestOnly) return results
    }

    // Check children
    const children = node.children || []
    for (const child of children) {
      const childResults = walkTree(child, predicate, options)
      results.push(...childResults)
    }

    return results
  }

  renderer.createRoot = function (options = {}) {
    let testInstance = null

    const root = {
      render(element) {
        if (testInstance) {
          testInstance.update(element)
        } else {
          testInstance = renderer.create(element, options)
        }
      },
      unmount() {
        if (testInstance) {
          testInstance.unmount()
          testInstance = null
        }
      },
      get container() {
        if (!testInstance) {
          return { children: [], toJSON: () => null, queryAll: () => [] }
        }
        const json = testInstance.toJSON()
        const wrapped = json ? [json] : []
        const containerObj = {
          children: wrapped,
          toJSON() {
            return testInstance ? testInstance.toJSON() : null
          },
          queryAll(predicate, queryOptions) {
            const rootJson = testInstance ? testInstance.toJSON() : null
            return rootJson ? walkTree(rootJson, predicate, queryOptions) : []
          },
          findAll(fn) {
            const rootJson = testInstance ? testInstance.toJSON() : null
            return rootJson ? walkTree(rootJson, fn, {}) : []
          },
          findAllByType(type) {
            const rootJson = testInstance ? testInstance.toJSON() : null
            return rootJson
              ? walkTree(rootJson, (n) => n.type === type, {})
              : []
          },
          findByType(type) {
            return (
              this.findAllByType(type)[0] || null
            )
          },
          findByProps(props) {
            const rootJson = testInstance ? testInstance.toJSON() : null
            const results = rootJson
              ? walkTree(
                  rootJson,
                  (n) => {
                    if (!n.props) return false
                    return Object.keys(props).every(
                      (k) => n.props[k] === props[k],
                    )
                  },
                  {},
                )
              : []
            return results[0] || null
          },
          get instance() {
            return testInstance ? testInstance.root.instance : null
          },
        }
        return containerObj
      },
    }

    return root
  }
}

renderer.act = renderer.act || require('react').act

module.exports = renderer