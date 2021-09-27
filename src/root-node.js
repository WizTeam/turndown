import collapseWhitespace from './collapse-whitespace'
import HTMLParser from './html-parser'
import { isBlock, isVoid } from './utilities'

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

function isFirstTextNode (node) {
  const elem = node.parentElement
  if (!elem) return false
  const parent = elem.parentElement
  if (!parent) return true
  //
  if (parent.tagName === 'SPAN' || parent.tagName === 'CODE') return false
  //
  if (elem.tagName === 'SPAN' || elem.tagName === 'CODE' || elem.id === 'turndown-root') {
    //
    const prev = elem.previousSibling
    if (!prev) return true
    //
    if (prev.tagName === 'BR') return true
    //
  }
  return false
}

function replaceSpaceToMarkdownSafeSpace (node) {
  //
  if (node.nodeType === 3) {
    const textContent = node.textContent
    if (textContent && textContent.startsWith(' ')) {
      //
      if (isFirstTextNode(node)) {
        node.textContent = replaceLeadSpaceToMarkdownSafeSpace(textContent)
      }
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

export default function RootNode (input, options) {
  var root
  if (typeof input === 'string') {
    var doc = htmlParser().parseFromString(
      // DOM parsers arrange elements in the <head> and <body>.
      // Wrapping in a custom element ensures elements are reliably arranged in
      // a single element.
      '<x-turndown id="turndown-root">' + input + '</x-turndown>',
      'text/html'
    )
    root = doc.getElementById('turndown-root')
  } else {
    root = input.cloneNode(true)
  }
  // added by wizweishijun
  replaceSpaceToMarkdownSafeSpace(root)
  //
  collapseWhitespace({
    element: root,
    isBlock: isBlock,
    isVoid: isVoid,
    isPre: options.preformattedCode ? isPreOrCode : null
  })

  return root
}

var _htmlParser
function htmlParser () {
  _htmlParser = _htmlParser || new HTMLParser()
  return _htmlParser
}

function isPreOrCode (node) {
  return node.nodeName === 'PRE' || node.nodeName === 'CODE'
}
