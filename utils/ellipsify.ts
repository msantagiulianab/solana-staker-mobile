export function ellipsify(str: unknown = '', len = 4, delimiter = '..') {
  const s = String(str ?? '')
  const strLen = s.length
  const limit = len * 2 + delimiter.length

  return strLen >= limit ? s.substring(0, len) + delimiter + s.substring(strLen - len, strLen) : s
}
