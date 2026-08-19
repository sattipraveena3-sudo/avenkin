const AVENKIN_ORIGIN = "https://nestlyne-care.sattipraveena3.chatgpt.site";

const worker = {
  async fetch(request) {
    const incoming = new URL(request.url);
    const target = new URL(
      incoming.pathname + incoming.search,
      AVENKIN_ORIGIN,
    );

    return fetch(new Request(target, request));
  },
};

export default worker;
