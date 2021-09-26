import COMMONMARK_RULES from './commonmark-rules'
import Rules from './rules'
import { extend, trimLeadingNewlines, trimTrailingNewlines } from './utilities'
import RootNode from './root-node'
import Node from './node'
var reduce = Array.prototype.reduce
var escapes = [
  [/\\/g, '\\\\'],
  [/\*/g, '\\*'],
  [/^-/g, '\\-'],
  [/^\+ /g, '\\+ '],
  [/^(=+)/g, '\\$1'],
  [/^(#{1,6}) /g, '\\$1 '],
  [/`/g, '\\`'],
  [/^~~~/g, '\\~~~'],
  [/\[/g, '\\['],
  [/\]/g, '\\]'],
  [/^>/g, '\\>'],
  [/_/g, '\\_'],
  [/^(\d+)\. /g, '$1\\. ']
]

export default function TurndownService (options) {
  if (!(this instanceof TurndownService)) return new TurndownService(options)

  var defaults = {
    rules: COMMONMARK_RULES,
    headingStyle: 'setext',
    hr: '* * *',
    bulletListMarker: '*',
    codeBlockStyle: 'indented',
    fence: '```',
    emDelimiter: '_',
    strongDelimiter: '**',
    linkStyle: 'inlined',
    linkReferenceStyle: 'full',
    br: '  ',
    preformattedCode: false,
    blankReplacement: function (content, node) {
      return node.isBlock ? '\n\n' : ''
    },
    keepReplacement: function (content, node) {
      return node.isBlock ? '\n\n' + node.outerHTML + '\n\n' : node.outerHTML
    },
    defaultReplacement: function (content, node) {
      return node.isBlock ? '\n\n' + content + '\n\n' : content
    }
  }
  this.options = extend({}, defaults, options)
  this.rules = new Rules(this.options)
}

const MARKDOWN_SAFE_SPACE = '\u2003'

function replaceLeadSpaceToMarkdownSafeSpace (text) {
  let count = 0
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === ' ') {
      count += 1
    } else {
      break
    }
  }
  //
  if (count === 0) {
    return text
  }
  //
  const newSpace = (new Array(count)).fill(MARKDOWN_SAFE_SPACE).join('')
  //
  return newSpace + text.substr(count)
}

function replaceSpaceToMarkdownSafeSpace (node) {
  //
  if (node.nodeType === 3) {
    const textContent = node.textContent
    if (textContent && textContent.startsWith(' ')) {
      // eslint-disable-next-line no-param-reassign
      node.textContent = replaceLeadSpaceToMarkdownSafeSpace(textContent)
    }
    return
  }
  //
  if (node.nodeType === 1) {
    //
    if (node.tagName === 'PRE' || node.tagName === 'CODE') {
      return
    }
    //
    node.childNodes.forEach(replaceSpaceToMarkdownSafeSpace)
  }
}

function createMarkdownSafeTrim (old) {
  return function markdownSafeTrim () {
    if (this.startsWith(MARKDOWN_SAFE_SPACE)) {
      if (this.endsWith(MARKDOWN_SAFE_SPACE)) {
        return this
      }
      return this.trimRight()
    }
    return old.apply(this)
  }
}

function replaceTrimForMarkdownSafeSpace (callback) {
  //
  const old = String.prototype.trim
  try {
    //
    // eslint-disable-next-line no-extend-native
    String.prototype.trim = createMarkdownSafeTrim(old)
    callback()
    //
  } finally {
    // eslint-disable-next-line no-extend-native
    String.prototype.trim = old
  }
}

TurndownService.prototype = {
  /**
   * The entry point for converting a string or DOM node to Markdown
   * @public
   * @param {String|HTMLElement} input The string or DOM node to convert
   * @returns A Markdown representation of the input
   * @type String
   */

  turndown: function (input) {
    if (!canConvert(input)) {
      throw new TypeError(
        input + ' is not a string, or an element/document/fragment node.'
      )
    }

    if (input === '') return ''

    var ret = ''
    replaceTrimForMarkdownSafeSpace(() => {
      const node = new RootNode(input, this.options)
      var output = process.call(this, node)
      ret = postProcess.call(this, output)
      // replace middle space char to white space
      ret = ret.replace(/(?!^)\u2003/gm, ' ')
    })

    return ret
  },

  /**
   * Add one or more plugins
   * @public
   * @param {Function|Array} plugin The plugin or array of plugins to add
   * @returns The Turndown instance for chaining
   * @type Object
   */

  use: function (plugin) {
    if (Array.isArray(plugin)) {
      for (var i = 0; i < plugin.length; i++) this.use(plugin[i])
    } else if (typeof plugin === 'function') {
      plugin(this)
    } else {
      throw new TypeError('plugin must be a Function or an Array of Functions')
    }
    return this
  },

  /**
   * Adds a rule
   * @public
   * @param {String} key The unique key of the rule
   * @param {Object} rule The rule
   * @returns The Turndown instance for chaining
   * @type Object
   */

  addRule: function (key, rule) {
    this.rules.add(key, rule)
    return this
  },

  /**
   * Keep a node (as HTML) that matches the filter
   * @public
   * @param {String|Array|Function} filter The unique key of the rule
   * @returns The Turndown instance for chaining
   * @type Object
   */

  keep: function (filter) {
    this.rules.keep(filter)
    return this
  },

  /**
   * Remove a node that matches the filter
   * @public
   * @param {String|Array|Function} filter The unique key of the rule
   * @returns The Turndown instance for chaining
   * @type Object
   */

  remove: function (filter) {
    this.rules.remove(filter)
    return this
  },

  /**
   * Escapes Markdown syntax
   * @public
   * @param {String} string The string to escape
   * @returns A string with Markdown syntax escaped
   * @type String
   */

  escape: function (string) {
    return escapes.reduce(function (accumulator, escape) {
      return accumulator.replace(escape[0], escape[1])
    }, string)
  }
}

/**
 * Reduces a DOM node down to its Markdown string equivalent
 * @private
 * @param {HTMLElement} parentNode The node to convert
 * @returns A Markdown representation of the node
 * @type String
 */

function process (parentNode) {
  var self = this
  return reduce.call(parentNode.childNodes, function (output, node) {
    node = new Node(node, self.options)

    var replacement = ''
    if (node.nodeType === 3) {
      replacement = node.isCode ? node.nodeValue : self.escape(node.nodeValue)
    } else if (node.nodeType === 1) {
      replacement = replacementForNode.call(self, node)
    }

    return join(output, replacement)
  }, '')
}

/**
 * Appends strings as each rule requires and trims the output
 * @private
 * @param {String} output The conversion output
 * @returns A trimmed version of the ouput
 * @type String
 */

function postProcess (output) {
  var self = this
  this.rules.forEach(function (rule) {
    if (typeof rule.append === 'function') {
      output = join(output, rule.append(self.options))
    }
  })

  return output.replace(/^[\t\r\n]+/, '').replace(/[\t\r\n\s]+$/, '')
}

/**
 * Converts an element node to its Markdown equivalent
 * @private
 * @param {HTMLElement} node The node to convert
 * @returns A Markdown representation of the node
 * @type String
 */

function replacementForNode (node) {
  var rule = this.rules.forNode(node)
  var content = process.call(this, node)
  var whitespace = node.flankingWhitespace
  if (whitespace.leading || whitespace.trailing) content = content.trim()
  //
  if (whitespace.leading) {
    content = content.replace(/^\u2003+/g, '') // added by wizweishijun
  } else if (content.startsWith('\u2003')) {
    return (
      rule.replacement(content, node, this.options) +
      whitespace.trailing
    )
  }
  //
  return (
    whitespace.leading +
    rule.replacement(content, node, this.options) +
    whitespace.trailing
  )
}

/**
 * Joins replacement to the current output with appropriate number of new lines
 * @private
 * @param {String} output The current conversion output
 * @param {String} replacement The string to append to the output
 * @returns Joined output
 * @type String
 */

function join (output, replacement) {
  var s1 = trimTrailingNewlines(output)
  var s2 = trimLeadingNewlines(replacement)
  var nls = Math.max(output.length - s1.length, replacement.length - s2.length)
  var separator = '\n\n'.substring(0, nls)

  return s1 + separator + s2
}

/**
 * Determines whether an input can be converted
 * @private
 * @param {String|HTMLElement} input Describe this parameter
 * @returns Describe what it returns
 * @type String|Object|Array|Boolean|Number
 */

function canConvert (input) {
  return (
    input != null && (
      typeof input === 'string' ||
      (input.nodeType && (
        input.nodeType === 1 || input.nodeType === 9 || input.nodeType === 11
      ))
    )
  )
}
