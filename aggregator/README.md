# BLS Aggregator

Aggregation service for bls-signed transaction data.

Accepts transaction bundles (including bundles that contain a single
transaction) and submits aggregations of these bundles to the configured
Verification Gateway.

## Installation

Install [Deno](deno.land)

### Configuration

```sh
cp .env.example .env
```

Edit values as needed, e.g. private key and contract addresses.

You can also configure multiple environments by appending `.<name>`, for example
you might have:

```
.env.local
.env.arbitrum-goerli
.env.optimism-goerli
```

If you don't have a `.env`, you will need to append `--env <name>` to all
commands.

#### Environment Variables

| Name                               | Example Value                                                      | Description                                                                                                                                                                                                                        |
| ---------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RPC_URL                            | https://localhost:8545                                             | The RPC endpoint for an EVM node that the BLS Wallet contracts are deployed on                                                                                                                                                     |
| RPC_POLLING_INTERVAL               | 4000                                                               | How long to wait between retries, when needed (used by ethers when waiting for blocks)                                                                                                                                             |
| USE_TEST_NET                       | false                                                              | Whether to set all transaction's `gasPrice` to 0. Workaround for some networks                                                                                                                                                     |
| ORIGIN                             | http://localhost:3000                                              | The origin for the aggregator client. Used only in manual tests                                                                                                                                                                    |
| PORT                               | 3000                                                               | The port to bind the aggregator to                                                                                                                                                                                                 |
| NETWORK_CONFIG_PATH                | ../contracts/networks/local.json                                   | Path to the network config file, which contains information on deployed BLS Wallet contracts                                                                                                                                       |
| PRIVATE_KEY_AGG                    | 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 | Private key for the EOA account used to submit bundles on chain                                                                                                                                                                    |
| PRIVATE_KEY_ADMIN                  | 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d | Private key for the admin EOA account. Used only in tests                                                                                                                                                                          |
| TEST_BLS_WALLETS_SECRET            | test-bls-wallets-secret                                            | Secret used to seed BLS Wallet private keys during tests                                                                                                                                                                           |
| PG_HOST                            | 127.0.0.1                                                          | Postgres database host                                                                                                                                                                                                             |
| PG_PORT                            | 5432                                                               | Postgres database port                                                                                                                                                                                                             |
| PG_USER                            | bls                                                                | Postgres database user                                                                                                                                                                                                             |
| PG_PASSWORD                        | generate-a-strong-password                                         | Postgres database password                                                                                                                                                                                                         |
| PG_DB_NAME                         | bls_aggregator                                                     | Postgres database name                                                                                                                                                                                                             |
| BUNDLE_TABLE_NAME                  | bundles                                                            | Postgres table name for bundles                                                                                                                                                                                                    |
| BUNDLE_QUERY_LIMIT                 | 100                                                                | Maximum number of bundles returned from Postgres                                                                                                                                                                                   |
| MAX_GAS_PER_BUNDLE                 | 2000000                                                            | Limits the amount of user operations which can be bundled together by using this value as the approximate limit on the amount of gas in an aggregate bundle.                                                                       |
| MAX_AGGREGATION_DELAY_MILLIS       | 5000                                                               | Maximum amount of time in milliseconds aggregator will wait before submitting bundles on chain                                                                                                                                     |
| MAX_UNCONFIRMED_AGGREGATIONS       | 3                                                                  | Maximum unconfirmed bundle aggregations that will be submitted on chain. Multiplied with `MAX_AGGREGATION_SIZE` to determine maximum of unconfirmed on chain actions                                                               |
| LOG_QUERIES                        | false                                                              | Whether to print Postgres queries in event log. When running tests, `TEST_LOGGING` must also be enabled.                                                                                                                           |
| TEST_LOGGING                       | false                                                              | Whether to print aggregator server events to stdout during tests. Useful for debugging & logging.                                                                                                                                  |
| REQUIRE_FEES                       | true                                                               | Whether to require that user bundles pay the aggregator a sufficient fee.                                                                                                                                                          |
| BREAKEVEN_OPERATION_COUNT          | 4.5                                                                | The aggregator must pay an overhead to submit a bundle regardless of how many operations it contains. This parameter determines how much each operation must contribute to this overhead.                                          |
| ALLOW_LOSSES                       | true                                                               | Even if each user bundle pays the required fee, the aggregate bundle may not be profitable if it is too small. Setting this to true makes the aggregator submit these bundles anyway.                                              |
| FEE_TYPE                           | ether OR token:0xabcd...1234                                       | The fee type the aggregator will accept. Either `ether` for ETH/chains native currency or `token:0xabcd...1234` (token contract address) for an ERC20 token                                                                        |
| AUTO_CREATE_INTERNAL_BLS_WALLET    | false                                                              | An internal BLS wallet is used to calculate bundle overheads. Setting this to true allows creating this wallet on startup, but might be undesirable in production (see `programs/createInternalBlsWallet.ts` for manual creation). |
| PRIORITY_FEE_PER_GAS               | 0                                                                  | The priority fee used when submitting bundles (and passed on as a requirement for user bundles).                                                                                                                                   |
| PREVIOUS_BASE_FEE_PERCENT_INCREASE | 2                                                                  | Used to determine the max basefee attached to aggregator transaction (and passed on as a requirement for user bundles)s.                                                                                                           |
| BUNDLE_CHECKING_CONCURRENCY        | 8                                                                  | The maximum number of bundles that are checked concurrently (getting gas usage, detecting fees, etc).                                                                                                                              |

### PostgreSQL

#### With docker-compose

```sh
cd .. # root of repo
docker-compose up -d postgres
```

#### Local Install

Install, e.g.:

```sh
sudo apt update
sudo apt install postgresql postgresql-contrib
```

Create a user called `bls`:

```
$ sudo -u postgres createuser --interactive
Enter name of role to add: bls
Shall the new role be a superuser? (y/n) n
Shall the new role be allowed to create databases? (y/n) n
Shall the new role be allowed to create more new roles? (y/n) n
```

Set the user's password:

```
$ sudo -u postgres psql                                                
psql (12.6 (Ubuntu 12.6-0ubuntu0.20.04.1))
Type "help" for help.

postgres=# ALTER USER bls WITH PASSWORD 'generate-a-strong-password';
```

Create a table called `bls_aggregator`:

```sh
sudo -u postgres createdb bls_aggregator
```

On Ubuntu (and probably elsewhere), postgres is configured to offer SSL
connections but with an invalid certificate. However, the deno driver for
postgres doesn't support this.

There are two options here:

1. Set up SSL with a valid certificate
   ([guide](https://www.postgresql.org/docs/current/ssl-tcp.html)).
2. Turn off SSL in postgres (only for development or if you can ensure the
   connection isn't vulnerable to attack).
   1. View the config location with
      `sudo -u postgres psql -c 'SHOW config_file'`.
   2. Turn off ssl in that config.
      ```diff
      -ssl = on
      +ssl = off
      ```
   3. Restart postgres `sudo systemctl restart postgresql`.

## Running

Can be run locally or hosted.

```sh
./programs/aggregator.ts
# Or if you have a named environment (see configuration section):
# ./programs/aggregator.ts --env <name>
```

## Testing

- launch optimism
- deploy contract script
- run tests

NB each test must use unique address(es). (+ init code)

## Fees

### User Guide

User bundles must pay fees to compensate the aggregator (except in testing
situations where the aggregator may be configured to accept bundles which don't
pay fees (see `REQUIRE_FEES`)). The aggregator simply detects fees have been
paid by observing the effect of a user bundle on its balance. This allows
bundles to pay the aggregator using any mechanism of their choosing, and is why
bundles do not have fields for paying fees explicitly.

The simplest way to do this is to include an extra action to pay `tx.origin`.

Use the `POST /estimateFee` API to determine the fee required for a bundle. The
body of this request is the bundle. Response:

```json
{
  "feeType": "(See FEE_TYPE enviroment variable)",
  "feeDetected": "(The fee that has been detected for the provided bundle)",
  "feeRequired": "(Required fee)",
  "successes": [/* Array of bools indicating success of each action */]
}
```

Note that if you want to pay the aggregator using an additional action, you
should include this additional action with a payment of zero when estimating,
otherwise the additional action will increase the fee that needs to be paid.

Also, `feeRequired` is the absolute minimum necessary fee to process the bundle
at the time of estimation, so paying extra is advisable to increase the chance
that the fee is sufficient during submission.

### Technical Detail

The fees required by the aggregator are designed to prevent it from losing
money. There are two main ways that losses can still happen:

1. Bundles that don't simulate accurately
2. Bundles that make losses are allowed in config (`ALLOW_LOSSES`)

When calculating the required fee, the aggregator needs to account for two
things:

1. The marginal cost of including the user bundle
2. A contribution to the overhead of submitting the aggregate bundle

Remember that the whole point of aggregation is to save on fees using a single
aggregate signature. This means that measuring the fee required to process the
user bundle in isolation won't reflect that saving.

Instead, we measure the overhead using hypothetical operations that contain zero
actions. We make a bundle with one of these, and another with two of these, and
extrapolate backwards to a bundle containing zero operations (see
`measureBundleOverheadGas`).

We can then subtract that overhead from the user's bundle to obtain its marginal
cost.

The user's share of the overhead is then added by multiplying it by
`operationCount / BREAKEVEN_OPERATION_COUNT`. User bundles usually have an
`operationCount` of 1, so if `BREAKEVEN_OPERATION_COUNT` is 4.5, then the bundle
will be required to pay 22% of the overhead.

From the aggregator's perspective, aggregate bundles with fewer operations than
`BREAKEVEN_OPERATION_COUNT` should make a loss, and larger bundles should make a
profit. If `ALLOW_LOSSES` is `false`, bundles which are predicted to make a loss
will not be submitted.

## Development

### Environment

This project is written in TypeScript targeting Deno. To get your tools to
interpret the code correctly you'll need deno-specific tooling - if you're using
VS Code then you should get the
[Deno Extension](https://marketplace.visualstudio.com/items?itemName=denoland.vscode-deno).

### Programs

The main entry point is located at `./programs/aggregator.ts`, but there are
other useful utilities in there that call into `src`, such as
`./programs/showTables.ts`. Everything in `src` is library-style code - it
provides functions, classes, constants etc, but doesn't do anything on its own
if you run it directly.

### Testing

Tests are defined in `test`. Running them directly is a bit verbose because of
the deno flags you need:

```sh
deno test --allow-net --allow-env --allow-read --unstable
```

Instead, `./programs/premerge.ts` may be more useful for you. It'll make sure
all TypeScript compiles correctly before running anything (in deno it's easy to
have broken TypeScript lying around because it only compiles the sources that
are actually imported whenever you run something). There's also a bunch of other
checking going on. As the name suggests, it's a good idea to make sure this
script completes successfully before merging into main.

### Troubleshooting

#### TS "Duplicate identifier" error

If you see TypeScript errors like below when attempting to run a script/command
from Deno such as `./programs/aggregator.ts`:

```sh
TS2300 [ERROR]: Duplicate identifier 'TypedArray'.
    type TypedArray =
         ~~~~~~~~~~
    at https://cdn.esm.sh/v59/node.ns.d.ts:508:10

    'TypedArray' was also declared here.
        type TypedArray =
             ~~~~~~~~~~
        at https://cdn.esm.sh/v62/node.ns.d.ts:508:10
```

You need to reload modules (`-r`):

```sh
deno run -r --allow-net --allow-env --allow-read --unstable ./programs/aggregator.ts
```

#### Transaction reverted: function call to a non-contract account

- Is `./contracts/contracts/lib/hubble-contracts/contracts/libs/BLS.sol`'s
  `COST_ESTIMATOR_ADDRESS` set to the right precompile cost estimator's contract
  address?
- Are the BLS Wallet contracts deployed on the correct network?
- Is `NETWORK_CONFIG_PATH` in `.env` set to the right config?

#### Deno version

Make sure your Deno version is
[up to date.](https://deno.land/manual/getting_started/installation#updating)

### Notable Components

- **src/chain**: Should contain all of the contract interactions, exposing more
  suitable abstractions to the rest of the code. There's still some contract
  interaction in `EthereumService` and in tests though.
- **`BlsWallet`**: Models a BLS smart contract wallet (see
  [BLSWallet.sol](https://github.com/jzaki/bls-wallet-contracts/blob/main/contracts/BLSWallet.sol)).
- **`app.ts`**: Runs the app (the aggregator), requiring only a definition of
  what to do with the events (invoked with `console.log` by
  `programs/aggregator.ts`).
- **`EthereumService`**: Responsible for submitting aggregations once they have
  been formed. This was where all the contract interaction was before
  `src/chain`. Might need some rethinking.
- **`BundleService`**: Keeps track of all stored transactions, as well as
  accepting (or rejecting) them and submitting aggregated bundles to
  `EthereumService`.
- **`BundleTable`**: Abstraction layer over postgres bundle tables, exposing
  typed functions instead of queries. Handles conversions to and from the field
  types supported by postgres so that other code can has a uniform js-friendly
  interface
  ([`TransactionData`](https://github.com/jzaki/bls-wallet-signer/blob/673e2ae/src/types.ts#L12)).
- **`Client`**: Provides an abstraction over the external HTTP interface so that
  programs talking to the aggregator can do so via regular js functions with
  types instead of dealing with raw HTTP. (This should maybe find its way into a
  separate library - at the moment bls-wallet-extension uses this via ad hoc
  copy+paste.)

## System Diagram

![System Diagram](./diagram.svg)

## Hosting Guide

1. Configure your server to allow TCP on ports 80 and 443
2. Follow the [Installation](#Installation) instructions
3. Install docker and nginx:
   `sudo apt update && sudo apt install docker.io nginx`

4. Run `./programs/build.ts`

- If you're using a named environment, add `--env <name>`
- If `docker` requires `sudo`, add `--sudo-docker`

5. Configure log rotation in docker by setting `/etc/docker/daemon.json` to

```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "100m",
    "max-file": "3"
  }
}
```

and restart docker `sudo systemctl restart docker`

6. Load the docker image: `sudo docker load <docker-image.tar.gz`
7. Copy `./programs/start-docker.sh` onto the server
8. Run the aggregator:

```sh
VERSION=abc1234 ./start-docker.sh
# Replace abc1234 with the first 7 characters of the git sha used when building
# A .env file is also required. You can also specify an alternative path using
# ENV_PATH=/custom/path/to/.env
```

9. Create `/etc/nginx/sites-available/aggregator`

```nginx
server {
  server_name your-domain.org;

  root /home/aggregator/static-content;
  index index.html;

  location / {
    try_files $uri $uri/ @aggregator;
  }

  location @aggregator {
    proxy_pass http://localhost:3000;
  }
}
```

This allows you to add some static content at `/home/aggregator/static-content`.
Adding static content is optional; requests that don't match static content will
be passed to the aggregator.

10. Create a symlink in sites-enabled

```sh
ln -s /etc/nginx/sites-available/aggregator /etc/nginx/sites-enabled/aggregator
```

Reload nginx for config to take effect: `sudo nginx -s reload`

11. Set up https for your domain by following the instructions at
    https://certbot.eff.org/lets-encrypt/ubuntufocal-nginx.
