import assert from "assert";
import { Protocol, Util } from "../../protocol/protocol";
import { Server } from "../mock/socket-io-server";
import { SocketIoClient } from "../../src/socket-io-client";

describe('Web socket client', () => {
    const port = 3333;
    const url = `http://localhost:${port}`
    let server: Server;

    before(async () => {
    });

    after(async () => {
    });

    it('Should send handshake', async () => {
        server = new Server({ port: port });
        await server.run();

        const client = new SocketIoClient({ url });
        await client.run();

        let error;
        let res;
        try {
            res = await client.sendHandshake({ clientId: Util._generateGUID() });
            
        } catch (e) {
            error = e;
        }

        client.shutdown()
        server.shutdown()

        assert.deepEqual(res, {error: null, payload: {}})
        assert(true);
    });




});
