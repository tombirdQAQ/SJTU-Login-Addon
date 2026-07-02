export function decodeCtc(data, dims, charset) {
  if (dims.length !== 3) {
    throw new Error(`模型输出维度异常：${dims.join("x")}`);
  }
  let sequenceLength;
  let classCount;
  let valueAt;

  if (dims[1] === 1) {
    [sequenceLength, , classCount] = dims;
    valueAt = (step, cls) => data[step * classCount + cls];
  } else if (dims[0] === 1) {
    [, sequenceLength, classCount] = dims;
    valueAt = (step, cls) => data[step * classCount + cls];
  } else {
    throw new Error(`模型输出批次维度异常：${dims.join("x")}`);
  }
  if (classCount !== charset.length) {
    throw new Error(
      `模型类别数 ${classCount} 与字符集 ${charset.length} 不一致`
    );
  }

  const decoded = [];
  let previous = -1;
  for (let step = 0; step < sequenceLength; step++) {
    let bestIndex = 0;
    let bestValue = valueAt(step, 0);
    for (let cls = 1; cls < classCount; cls++) {
      const value = valueAt(step, cls);
      if (value > bestValue) {
        bestValue = value;
        bestIndex = cls;
      }
    }
    if (bestIndex !== previous && bestIndex !== 0) {
      decoded.push(charset[bestIndex]);
    }
    previous = bestIndex;
  }
  return decoded.join("");
}
