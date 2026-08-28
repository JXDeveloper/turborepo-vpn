### entities

1. user (manageged by clerk)
2. subscriptions (managed by clerk)
3. Control Panel
4. Exit Node
5. Peer(client side which needs to connect)

drizzle-orm and neon db will be used for database

# (user need a vpn service)

## first time user on our application

1. user will sign in to application (Managed by clerk)
2. he will be on landing page with button to see pricing plan
3. he will select pricing plan and redirected to home (managed by clerk)
4. he will see dashboard button
5. he will click on that
6. dashboard will redirect it to dashboard/home page
7. this page consist create peer button
8. user will click on create peer button
9. Control panel will get user keys from its post request and send them to neon db along with its id.
10. this data will persists there for future reuse
11. as soon as neon db confirm successfull creation of row on db, Control Panel will make request to exit node to create peer
12. Exit node will create a peer and respond with configuration client need to connect to server
13. Control Panel will display the config on dashboard along with QRCode to scan
14. User can scan QRCode in wireguard app and connect direclty to vpn exit node

## next time user on out application

1. user will sign in to application
2. Control Panel check for auth and payments

### user has subs left yet

3. Control Panel will load its configs from exit node based on id found in neon db
4. Control Panel will display available peer to him and generate QRCode again if he need

### user does not have subs left

3. Control Panel will diplay u have no subs left in dashboard

# Sub revocatoin

1. Control Panel will provide web hook to subscription end event to clerk
2. when hook is called client will mark user record as revoked in subs columns
3. Control Panel will call revoke_peer/:id endpoint on exit node to immediately halt the sevice
