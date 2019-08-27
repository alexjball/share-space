# Open Rooms
This describes the motivation and design for an open-source replacement for Rabb.it. It focuses on self-hosted use cases, where users maintain their own Rabb.it-like infrastructure.

## Goals
Make it easy to CRUD screenshare rooms using personal computing resources.

Provide a dashboard web interface that allows users to create and manage room instances.

Provide a room web interface that allows users to join rooms. Rooms can be private, open only to specific users, or public. 

## Future Goals
We will eventually want to make the dashboard and room scale to something the size of Rabb.it. In this case, the service provider hosts both the dashboard and room instances.

We may also want to pursue a hybrid approach, where the service provider hosts the dashboard and supports 3rd party room instances. As an option, the service provider could offer its own hosted rooms. It's much cheaper to host the dashboard than room instances, but we still offer significant value by simplifying setup of self-hosted rooms. Offering this for free builds trust which improves 1st party room sales.

## Requirements
Deployment configurations:
- Personal desktop (with a VM) hosting everything
- Personal laptop (with a VM) hosting the dashboard and offloading the room instance to the cloud
- Personal cloud VM hosting everything
- Light personal cloud VM hosting the dashboard, offloading to a beefier VM for the room instance

Rooms have Owners, Participants, and Viewers. Owners can start/stop the room. Participants can control the room and send messages. Viewers can just view the stream.

# Design
Room servers run as Docker containers. Clients connect to room instances with a RoomService interface. 

For self-hosted deployments, Room instances are 1-1 with room servers. If a service provider is providing rooms, they may want to run the RoomService as a distributed service.
<!--stackedit_data:
eyJoaXN0b3J5IjpbMTMzNzg0NDgxNywxMDAzNTg3MjE3LDE0Nz
gyMzczNTcsMTkxMjQ1OTE0NywyNjMzOTgzNCwxNDg4Mzg3MTE3
XX0=
-->