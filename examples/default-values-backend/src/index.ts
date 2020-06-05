import * as Hapi from "@hapi/hapi";
import fetch from "node-fetch";
import { makeAppToken, getAppAccessToken, getPrivateKey, getKeyId } from "./utils";
import Path from "path";
import dotenv from "dotenv";
dotenv.config();

const { APP_ID, CONTENT_TYPE_ID, BASE_URL } = process.env;

/* This file is our backend App. It's a very straight forward Hapi server that
 * listens for calls from a webhook, and then uses an AppToken to interact
 * with the Content Management Api (CMA).
 */

// -------------------
// MAIN SERVER
// -------------------

const startServer = async () => {
  // First we create a JWT token based on our private key, and the App's id
  const appToken = makeAppToken(APP_ID, getPrivateKey(), getKeyId());

  const server = Hapi.server({
    port: 3543,
    host: "localhost",
    routes: {
      files: {
        relativeTo: Path.join(__dirname, "../../dist"),
      },
    },
  });

  await server.register(require("@hapi/inert"));

  // Here we are attaching the webook handler to our Server
  server.route(addDefaultData(appToken));

  server.route({
    method: "GET",
    path: "/frontend",
    handler: function (request, h: any) {
      return h.file("index.html");
    },
  });

  server.route({
    method: "GET",
    path: "/{param*}",
    handler: {
      directory: {
        path: "./",
      },
    },
  });

  await server.start();

  console.log("Server running on %s", server.info.uri);
};

process.on("unhandledRejection", err => {
  console.error("[Unhandled Rejection]");

  console.log(err);
  process.exit(1);
});

process.on("uncaughtException", error => {
  console.error("[Uncaught Exception]");
  console.error(error);

  process.exit(1);
});

startServer();

// -------------------
// HANDLER FOR WEBHOOK
// -------------------

// This route is listening to a webhook that is setup to call whenever an
// Entry of our example content type is created
const addDefaultData = (appToken: string) => ({
  method: "POST",
  path: "/event-handler",
  handler: async (request: Hapi.Request, h: Hapi.ResponseToolkit) => {
    try {
      const payload = request.payload as {
        sys: 
          { id: string; 
            version: string; 
            space: { sys: { id: string } }; 
            environment: { sys: { id: string } }; 
            contentType: { sys: { id: string } } ;
          };
      };

      // First we extract the Entry id and version from the payload

      const { id, version, contentType, space, environment } = payload.sys;
      const spaceId = space.sys.id;
      const environmentId = environment.sys.id;

      console.log(`Received webhook request because Entry ${id} was created`);

      if (contentType.sys.id !== CONTENT_TYPE_ID) {
        // If the content type does not match the one we created in setup, we just
        // ignore the event
        console.log(
          `Entry's content type: ${contentType.sys.id} did not match the content type created for the App, ignoring`
        );
        return h.response("success").code(204);
      }

      // We then use that token to get a token from Contentful which our App can use
      // to interact with the CMA
      const appAccessToken = await getAppAccessToken(appToken, spaceId, environmentId, APP_ID);

      const appInstallation = await fetch(
        `${BASE_URL}/spaces/${spaceId}/environments/${environmentId}/app_installations/${APP_ID}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${appAccessToken}`,
            "Content-Type": "application/json",
          },
        }
      ).then(r => r.json());

      const defaultValue = appInstallation?.parameters?.defaultValue
        ? appInstallation.parameters.defaultValue
        : "Default value";

      // Then we make a request to contentful's CMA to update the Entry with our
      // default values
      const res = await fetch(
        `${BASE_URL}/spaces/${spaceId}/environments/${environmentId}/entries/${id}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${appAccessToken}`,
            "X-Contentful-Content-Type": contentType.sys.id,
            "Content-Type": "application/json",
            "X-Contentful-Version": version,
          },
          body: JSON.stringify({ fields: { title: { "en-US": defaultValue } } }),
        }
      );
      if (res.status === 200) {
        console.log(`Set default values for Entry ${id}`);
        return h.response("success").code(204);
      } else {
        throw new Error("failed to set default values" + (await res.text()));
      }
    } catch (e) {
      console.error(e);
      throw new Error(e);
    }
  },
});
