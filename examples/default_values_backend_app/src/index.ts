import * as Hapi from "@hapi/hapi";
import fetch from "node-fetch";
import { makeAppToken, getAppAccessToken, getPrivateKey, getKeyId } from "./utils";
import dotenv from "dotenv";
dotenv.config();

const { APP_ID, SPACE_ID, ENVIRONMENT_ID } = process.env;

// -------------------
// MAIN SERVER
// -------------------

const init = async () => {
  const appToken = makeAppToken(APP_ID, getPrivateKey(), getKeyId());
  const accessToken = await getAppAccessToken(appToken, SPACE_ID, ENVIRONMENT_ID, APP_ID);

  const server = Hapi.server({
    port: 3543,
    host: "localhost",
  });

  server.route(addDefaultData(accessToken));

  await server.start();

  console.log("Server running on %s", server.info.uri);
};

process.on("unhandledRejection", err => {
  console.error("[Unhandled Rejection]");

  console.log(err);
  process.exit(1);
});

init();

process.on("uncaughtException", error => {
  console.error("[Uncaught Exception]");
  console.error(error);

  process.exit(1);
});

// -------------------
// HANDLER FOR WEBHOOK
// -------------------

const contentType = "example";
const defaultValues = {
  fields: {
    title: {
      "en-US": "All my blog posts start with this title",
    },
  },
};

// This route is listening to a webhook that is setup to call whenever an
// Entry of our example content type is created
const addDefaultData = (appAccessToken: string) => ({
  method: "POST",
  path: "/create",
  handler: async (request: Hapi.Request, h: Hapi.ResponseToolkit) => {
    // First we extract the Entry id and version from the payload
    const payload = request.payload as {
      sys: { id: string; version: string; contentType: { sys: { id: string } } };
    };
    const { id, version, contentType } = payload.sys;
    console.log(payload.sys);
    console.log(`Received webhook request because Entry ${id} was created`);

    // Then we make a request to contentful's CMA to update the Entry with our
    // default values
    const res = await fetch(
      `https://api.flinkly.com/spaces/${SPACE_ID}/environments/${ENVIRONMENT_ID}/entries/${id}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${appAccessToken}`,
          "X-Contentful-Content-Type": contentType.sys.id,
          "Content-Type": "application/json",
          "X-Contentful-Version": version,
        },
        body: JSON.stringify(defaultValues),
      }
    );

    if (res.status === 200) {
      console.log(`Set default values for Entry ${id}`);
      return h.response("success").code(204);
    } else {
      throw new Error("failed to set default values");
    }
  },
});
