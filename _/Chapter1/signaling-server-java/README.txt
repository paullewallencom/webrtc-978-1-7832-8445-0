 How to compile
================

mvn compile
mvn package

 How to start
==============

On Windows: %JAVA_HOME%\bin\java -classpath "target\SignalingServer-1.0-SNAPSHOT.jar;target\lib\*" com.webrtcexample.signaler.Main
On Linux: ${JAVA_HOME}/bin/java -classpath "target/SignalingServer-1.0-SNAPSHOT.jar:target/lib/*" com.webrtcexample.signaler.Main

The signaler server will be listening on localhost:30001
It can be used for all other examples.
