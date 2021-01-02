
 How to compile
================

rebar get-deps
rebar compile

 How to start
==============

For Windows: erl -pa deps/cowboy/ebin deps/cowlib/ebin deps/gproc/ebin deps/jsonerl/ebin deps/ranch/ebin ebin -sasl errlog_type error -s sigserver_app
For Linux: erl -pa deps/*/ebin ebin -sasl errlog_type error -s sigserver_app

The signaler server will be listening on localhost:30001
It is suitable for all other examples.
