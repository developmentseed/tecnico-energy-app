import ms from "ms"

export const timeAgo = (timestamp: Date, timeOnly?: boolean): string => {
  if (!timestamp) return "never"
  return `${ms(Date.now() - new Date(timestamp).getTime())}${
    timeOnly ? "" : " ago"
  }`
}

export const largeNumberDisplay = (number: number, decimals = 2): string => {
  if (number < 1000) {
    return number.toString() // Return the number as is if it's less than 1000
  } else if (number < 1000000) {
    return (number / 1000).toFixed(decimals) + "K" // Convert to thousands
  } else if (number < 1000000000) {
    return (number / 1000000).toFixed(decimals) + "M" // Convert to millions
  } else if (number < 1000000000000) {
    return (number / 1000000000).toFixed(decimals) + "B" // Convert to billions
  } else {
    return (number / 1000000000000).toFixed(decimals) + "T" // Convert to trillions
  }
}
