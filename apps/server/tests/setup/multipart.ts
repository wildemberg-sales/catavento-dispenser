const BOUNDARY = "----catavento-test-boundary";

export function buildMultipartBody(params: {
  fieldName: string;
  filename: string;
  content: Buffer | string;
  contentType?: string;
}): { body: Buffer; contentType: string } {
  const contentBuffer = Buffer.isBuffer(params.content) ? params.content : Buffer.from(params.content);
  const head = Buffer.from(
    `--${BOUNDARY}\r\n` +
      `Content-Disposition: form-data; name="${params.fieldName}"; filename="${params.filename}"\r\n` +
      `Content-Type: ${params.contentType ?? "application/octet-stream"}\r\n\r\n`
  );
  const tail = Buffer.from(`\r\n--${BOUNDARY}--\r\n`);
  return {
    body: Buffer.concat([head, contentBuffer, tail]),
    contentType: `multipart/form-data; boundary=${BOUNDARY}`,
  };
}
