export const onRequestGet: PagesFunction = async (context) => {
  return new Response('Pages Functions placeholder', {
    headers: { 'content-type': 'text/plain' }
  });
};
