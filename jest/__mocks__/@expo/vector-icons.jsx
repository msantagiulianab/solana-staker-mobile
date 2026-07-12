const React = require('react')
const { Text } = require('react-native')

function MockIcon({ name, ...props }) {
  return React.createElement(Text, props, String(name))
}

module.exports = MockIcon
module.exports.MaterialIcons = MockIcon