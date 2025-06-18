export function generateKey(dataName) {
    let hash = 2166136261;
    for (let i = 0; i < dataName.length; i++) {
      hash ^= dataName.charCodeAt(i);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return Math.abs(hash >>> 0).toString(16).slice(0, 8);
}