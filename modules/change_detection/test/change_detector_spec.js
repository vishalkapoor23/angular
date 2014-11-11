import {ddescribe, describe, it, iit, xit, expect} from 'test_lib/test_lib';

import {List, ListWrapper} from 'facade/collection';
import {Parser} from 'change_detection/parser/parser';
import {Lexer} from 'change_detection/parser/lexer';
import {ClosureMap} from 'change_detection/parser/closure_map';

import {
  ChangeDetector,
  ProtoWatchGroup,
  WatchGroup,
  WatchGroupDispatcher,
  ProtoRecord
} from 'change_detection/change_detector';

import {Record} from 'change_detection/record';

export function main() {
  function ast(exp:string) {
    var parser = new Parser(new Lexer(), new ClosureMap());
    return parser.parseBinding(exp);
  }

  function createChangeDetector(memo:string, exp:string, context = null) {
    var pwg = new ProtoWatchGroup();
    pwg.watch(ast(exp), memo, false);

    var dispatcher = new LoggingDispatcher();
    var wg = pwg.instantiate(dispatcher);
    wg.setContext(context);

    var cd = new ChangeDetector(wg);

    return {"changeDetector" : cd, "dispatcher" : dispatcher};
  }

  function executeWatch(memo:string, exp:string, context = null) {
    var res = createChangeDetector(memo, exp, context);
    res["changeDetector"].detectChanges();
    return res["dispatcher"].log;
  }

  describe('change_detection', () => {
    describe('ChangeDetection', () => {
      it('should do simple watching', () => {
        var person = new Person("misko");

        var c = createChangeDetector('name', 'name', person);
        var cd = c["changeDetector"];
        var dispatcher = c["dispatcher"];

        cd.detectChanges();
        expect(dispatcher.log).toEqual(['name=misko']);

        dispatcher.clear();
        cd.detectChanges();
        expect(dispatcher.log).toEqual([]);

        person.name = "Misko";
        cd.detectChanges();
        expect(dispatcher.log).toEqual(['name=Misko']);
      });

      it('should watch chained properties', () => {
        var address = new Address('Grenoble');
        var person = new Person('Victor', address);

        expect(executeWatch('address.city', 'address.city', person))
              .toEqual(['address.city=Grenoble']);
      });

      it("should watch literals", () => {
        expect(executeWatch('const', '10')).toEqual(['const=10']);
      });

      it("should watch binary operations", () => {
        expect(executeWatch('exp', '10 + 2')).toEqual(['exp=12']);
        expect(executeWatch('exp', '10 - 2')).toEqual(['exp=8']);

        expect(executeWatch('exp', '10 * 2')).toEqual(['exp=20']);
        expect(executeWatch('exp', '10 / 2')).toEqual([`exp=${5.0}`]); //dart exp=5.0, js exp=5
        expect(executeWatch('exp', '11 % 2')).toEqual(['exp=1']);

        expect(executeWatch('exp', '1 == 1')).toEqual(['exp=true']);
        expect(executeWatch('exp', '1 != 1')).toEqual(['exp=false']);

        expect(executeWatch('exp', '1 < 2')).toEqual(['exp=true']);
        expect(executeWatch('exp', '2 < 1')).toEqual(['exp=false']);

        expect(executeWatch('exp', '2 > 1')).toEqual(['exp=true']);
        expect(executeWatch('exp', '2 < 1')).toEqual(['exp=false']);

        expect(executeWatch('exp', '1 <= 2')).toEqual(['exp=true']);
        expect(executeWatch('exp', '2 <= 2')).toEqual(['exp=true']);
        expect(executeWatch('exp', '2 <= 1')).toEqual(['exp=false']);

        expect(executeWatch('exp', '2 >= 1')).toEqual(['exp=true']);
        expect(executeWatch('exp', '2 >= 2')).toEqual(['exp=true']);
        expect(executeWatch('exp', '1 >= 2')).toEqual(['exp=false']);

        expect(executeWatch('exp', 'true && true')).toEqual(['exp=true']);
        expect(executeWatch('exp', 'true && false')).toEqual(['exp=false']);

        expect(executeWatch('exp', 'true || false')).toEqual(['exp=true']);
        expect(executeWatch('exp', 'false || false')).toEqual(['exp=false']);
      });
    });
  });
}

class Person {
  constructor(name:string, address:Address = null) {
    this.name = name;
    this.address = address;
  }

  toString():string {
    var address = this.address == null ? '' : ' address=' + this.address.toString();

    return 'name=' + this.name + address;
  }
}

class Address {
  constructor(city:string) {
    this.city = city;
  }

  toString():string {
    return this.city;
  }
}

class LoggingDispatcher extends WatchGroupDispatcher {
  constructor() {
    this.log = null;
    this.clear();
  }

  clear() {
    this.log = ListWrapper.create();
  }

  onRecordChange(record:Record, context) {
    ListWrapper.push(this.log, context + '=' + record.currentValue.toString());
  }
}
