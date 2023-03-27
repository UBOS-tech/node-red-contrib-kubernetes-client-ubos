/**
 * https://github.com/kubernetes-client/javascript/issues/392
 *
 */
module.exports = function(RED) {
  "use strict";
  const KubeConfig = require("./config").KubeConfig;

  /**
   * https://nodered.org/docs/creating-nodes/status
   * The shape property can be: ring or dot
   * The fill property can be: red, green, yellow, blue or grey
   */
  const statuses = {
    connecting: { fill: "yellow", shape: "ring", text: "connecting" },
    connected: { fill: "green", shape: "dot", text: "connected" },
    disconnected: { fill: "red", shape: "ring", text: "disconnected" },
    misconfigured: { fill: "red", shape: "ring", text: "misconfigured" },
    error: { fill: "red", shape: "dot", text: "error" },
    sending: { fill: "blue", shape: "dot", text: "sending" },
    receiving: { fill: "blue", shape: "dot", text: "receiving" },
    transfer: { fill: "blue", shape: "dot", text: "transfer" },
    blank: {}
  };

  // function KubernetesClientConfigNode(n) {
  //   RED.nodes.createNode(this, n);
  //   this.options = {};
  //   this.kc = new KubeConfig();

  //   if (this.credentials.kubeConfig) {
  //     this.kc.loadFromString(this.credentials.kubeConfig);
  //   } else {
  //     this.kc.loadFromDefault();
  //   }

  //   this.on("close", (removed, done) => {
  //     if (removed) {
  //       // This node has been deleted
  //     } else {
  //       // This node is being restarted
  //     }
  //     this.kc.discoveryCache.reset();
  //     delete this.kc.discoveryCache;
  //     delete this.kc;

  //     done();
  //   });
  // }

  // RED.nodes.registerType(
  //   "kubernetes-client-config-ubos",
  //   KubernetesClientConfigNode,
  //   {
  //     credentials: {
  //       kubeConfig: { type: "text" }
  //     }
  //   }
  // );

  /**
   * TODO: support new option to 'continue' through the pages of responses
   *
   * @param {*} n
   */
  function KubernetesClientHttpNode(n) {
    RED.nodes.createNode(this, n);

    this.options = {};

    const node = this;
    node.lastMessageTimestamp = 0;
    const kc = new KubeConfig();
   // this.kubernetesClientConfig = n.kubernetesClientConfig;
    // this.kubernetesClientConfigNode = RED.nodes.getNode(
    //   this.kubernetesClientConfig
    // );

    // if (this.credentials.kubeConfig) {
    //   this.kc.loadFromString(this.credentials.kubeConfig);
    // } else {
    //   this.kc.loadFromDefault();
    // }
    // const kc = this.kubernetesClientConfigNode.kc;

    // this.on("close", (removed, done) => {
    //   if (removed) {
    //     // This node has been deleted
    //   } else {
    //     // This node is being restarted
    //   }
    //   kc.discoveryCache.reset();
    //   delete kc.discoveryCache;
    //   delete kc;

    //   done();
    // });




    //if (n.kubeConfig || true) {
      node.on("input", async function(msg, send, done) {
        node.status(statuses.sending);

        // support of 1.0+ and pre-1.0
        send =
          send ||
          function() {
            node.send.apply(node, arguments);
          };
         
          kc.loadFromString(msg.kubeConfig || "");

          
        try {
          /**
           * Properties of the response include:
           *
           * statusCode
           * body
           * headers
           * request
           */
          let res = await kc.makeHttpRestRequest(msg);
          msg.payload = res.body;

          /**
           * try to add selfLink to involvedObject
           */
          if (
            ["Event", "EventList"].includes(msg.payload.kind) &&
            msg.payload.apiVersion == "v1"
          ) {
            try {
              switch (msg.payload.kind) {
                case "Event":
                  await kc.dressEventResource(msg.payload);

                  break;
                case "EventList":
                  await Promise.all(
                    msg.payload.items.map(async element => {
                      try {
                        return kc.dressEventResource(element);
                      } catch (err) {}
                    })
                  );

                  break;
              }
            } catch (err) {}
          }

          msg.kube = {};
          msg.kube.response = JSON.parse(JSON.stringify(res));
          msg.kube.config = {};
          msg.kube.config.cluster = kc.getCurrentCluster();
          msg.kube.config.context = kc.getCurrentContext();
          msg.kube.config.user = kc.getCurrentUser();
          msg.kube.client = kc;
          send(msg);
          node.status(statuses.blank);
          if (done) {
            done();
          }
        } catch (err) {
          const status = JSON.parse(JSON.stringify(statuses.error));
          status.text = status.text + ": " + err;
          node.status(status);

          // Report back the error
          if (done) {
            // Use done if defined (1.0+)
            done(err);
          } else {
            // Fallback to node.error (pre-1.0)
            node.error(err, msg);
          }
        }
      });
   // }
    //  else {
    //   node.error("missing KubeConfig");
    //   node.status(statuses.misconfigured);
    // }
  }
  RED.nodes.registerType("kubernetes-client-http-ubos", KubernetesClientHttpNode);
};
