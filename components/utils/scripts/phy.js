elation.extend("utils.physics.system", new function() {
  this.objects = [];
  this.active = false;
  this.lambda = 5;

  this.init = function() {
  }
  this.start = function() {
    this.active = true;
  }
  this.iterate = function(t) {
    // If there are no objects we have nothing to do
    if (!this.active || this.objects.length == 0) return;

    // If it's been more than 2 seconds, the browser was probably inactive/paused
    if (t > 2) return; 

    // Switch to 4th-order integration if framerate is < 50fps
    var subdivisions = (t < .02 ? 1 : 4); 
    var timeslice = t / subdivisions;

    for (var s = 0; s < subdivisions; s++) {
      this.collisioncache = {};
      for (var k in this.objects) {
        if (!this.objects[k].sleeping) {
          this.checkCollision(this.objects[k], timeslice);
        }
      }        
    }
  }
  this.checkCollision = function(obj, t) {
    if (obj.radius > 0) {
      var ray = new THREE.Ray(obj.pos, obj.vel.clone().normalize());
  //console.log(ray);
      var speed = obj.vel.length();
      //var c = THREE.Collisions.rayCastNearest(ray);
      var objects = ray.intersectScene(elation.space.fly(0).scene);
      c = objects[0];
      if (c) { // && c.distance <= speed) {
  //console.log(objects);
        
        var vrel = obj.vel.clone();
        if (c.object && c.object.dynamics) {
          vrel.subSelf(c.object.dynamics.vel);
        }
        var vsep = vrel.dot(c.face.normal);
        //console.log("vsep", vsep, obj.radius);
        if (vsep > 0) {
          //console.log('already moving away');
        } else if (obj.radius > 0 && (c.distance - obj.radius) <= speed * t) {
          console.log('crash at ', c.distance, speed, speed * t, obj.vel, obj.radius);
          //obj.setVelocity([0,0,0]);
          obj.bounce(c, t);
        } else {
        }
      } else {
      }
    }
    obj.iterate(t);
  }
  this.add = function(obj) {
    if (obj instanceof elation.utils.physics.object) {
      var idx = this.objects.push(obj)-1;
    } else {
      var idx = this.objects.push(new elation.utils.physics.object(obj))-1;
    }
    console.log("added dynamics object:", this.objects[idx]);
  }
  this.init();
});

elation.extend("utils.physics.object", function(args) {
  this.args = args || {};
  this.sleeping = false;
  this.mass = this.args.mass || 1;        // Mass, in kg
  this.drag = this.args.drag || 0;
  this.friction = this.args.friction || 0;
  this.pos = this.args.position || new THREE.Vector3(0,0,0); // Position, in m
  this.rot = this.args.rotation || new THREE.Vector3(0,0,0); // Rotation, in radians
  this.vel = this.args.vel || new THREE.Vector3(0,0,0); // Velocity, in m/s
  this.angular = this.args.angular || new THREE.Vector3(0,0,0); // Rotational velocity, in degrees/s
  this.restitution = this.args.restitution || 1;
  this.radius = this.args.radius || 0;
  this.forces = {'_num': 0}; // Forces on this object, in N
  this.forcesum = new THREE.Vector3();

  this.init = function() {
    console.log('Initialized physics object', this);
  }
  this.iterate = function(t) {
    if (!this.sleeping) {
      var fallasleep = true;
      if ((this.drag > 0 || this.friction > 0)) {
        this.calculateFriction();
      }
      if (this.accel && this.accel.length() > elation.utils.physics.system.lambda) {
        //this.vel = this.vel.add(this.accel.multiply(.5*t*t));
        this.vel.addSelf(this.accel.clone().multiplyScalar(.5*t*t));
        fallasleep = false;
      }
      if (this.vel.length() > elation.utils.physics.system.lambda) {
        this.pos.addSelf(this.vel.clone().multiplyScalar(t));
        fallasleep = false;
      }
      if (this.rotating) {
        this.rot.addSelf(this.angular.clone().multiplyScalar(t));
        //elation.events.fire({type: "rotate", element: this, data: this.angular.clone().multiplyScalar(t)});
      }
/*
      this.sleeping = fallasleep;
      if (this.sleeping) {
        this.removeForce("gravity");
      }
*/
      this.updateSleepState();
      //console.log(fallasleep ? "fall asleep" : "keep going");
      elation.events.fire({type: "dynamicsupdate", element: this});
    }
  }
  this.addForce = function(name, force) {
    if (force instanceof THREE.Vector3)
      this.forces[name] = force;
    else
      this.forces[name] = new THREE.Vector3(force[0], force[1], force[2]);
    this.forces._num++;

    this.calculateAcceleration();
    //console.log('added force', name, [force.x, force.y, force.z], [this.accel.x, this.accel.y, this.accel.z]);
  }
  this.updateSleepState = function() {
    this.sleeping = !((this.accel && this.accel.length() > 0) || (this.vel && this.vel.length() > 0) || (this.angular && this.angular.length() > 0));
    return this.sleeping;
  }
  this.removeForce = function(name) {
    if (this.forces[name]) {
      delete this.forces[name];
      this.forces._num--;
      this.calculateAcceleration();
      //console.log('removed force', name, [this.accel.x, this.accel.y, this.accel.z]);
    }
  }
  this.calculateAcceleration = function() {
    this.forcesum.set(0,0,0);
    if (this.forces._num > 0) {
      for (var k in this.forces) {
        if (k != "_num") {
          this.forcesum.addSelf(this.forces[k]);
        }
      }

      this.accel = this.forcesum.multiplyScalar(1/this.mass);
    } else {
      this.accel = false;
    }
    this.updateSleepState();
  }
  this.setFriction = function(friction) {
    this.friction = friction;
    if (friction == 0) {
      this.removeForce('friction');
    }
  }
  this.calculateFriction = function(time) {
    var v = this.vel.length();

    if (v > 0.00001) {
      if (this.drag > 0) {
        var fd = this.vel.clone().multiplyScalar(-.5*this.drag*v);
        this.addForce("drag", fd);
      }
      if (this.friction > 0) {
        var fd = this.vel.clone().multiplyScalar(-1 * this.friction * this.mass);
        this.addForce("friction", fd);
      }
    } else {
      //console.log('stopped', this.vel);
      // Friction always wins!  We've ground to a halt.
      this.removeForce("friction");
      this.removeForce("drag");
      //this.vel.set(0,0,0);
      //this.accel = false; // Are we 100% sure this is what we want?  What happens if there are still other forces being applied?
      this.updateSleepState();
    }
  }
  this.setVelocity = function(xyz) {
    if (xyz instanceof THREE.Vector3) {
      this.vel.set(xyz.x, xyz.y, xyz.z);
    } else {
      this.vel.set(xyz[0], xyz[1], xyz[2]);
    }
    this.updateSleepState();
  }
  this.setVelocityX = function(x) {
    this.setVelocity([x, this.vel.y, this.vel.z]);
  }
  this.setVelocityY = function(y) {
    this.setVelocity([this.vel.x, y, this.vel.z]);
  }
  this.setVelocityZ = function(z) {
    this.setVelocity([this.vel.x, this.vel.y, z]);
  }
  this.setAngularVelocity = function(xyz) {
    if (xyz instanceof THREE.Vector3) {
      this.angular = xyz;
    } else {
      this.angular.set(xyz[0], xyz[1], xyz[2]);
    }
    this.rotating = true;//!(this.angular.length() == 0);
    this.updateSleepState();
  }
  this.bounce = function(collision, t) {
    var normal = collision.face.normal;
    
    var relvel = this.vel.clone();
    var accvel = this.accel.clone();
    var restitution = this.restitution;
    var imass = 0;
    if (this.mass > 0) {
      imass += 1 / this.mass;
    }

    if (collision.object && collision.object.dynamics) {
      relvel.subSelf(collision.object.dynamics.vel);
      accvel.subSelf(collision.object.dynamics.accel);
      restitution *= collision.object.dynamics.restitution;
      if (collision.object.dynamics.mass > 0)
        imass += 1 / collision.object.dynamics.mass;
    }

    var sepspeed = relvel.dot(normal);
    if (sepspeed > 0) { // moving away, do nothing
      return;
    }
    var newsepspeed = -sepspeed * restitution;
    var accsepspeed = accvel.dot(normal) * .5 * t * t;

    if (accsepspeed < sepspeed) {
      newsepspeed += restitution * accsepspeed;
      if (newsepspeed < 0) newsepspeed = 0;
    }

    var deltaspeed = newsepspeed - sepspeed;
//console.log(relvel, accvel, sepspeed, accsepspeed, newsepspeed, restitution, t);

    if (imass <= 0) return; // infinite mass = no impulses

    var impulse = deltaspeed / imass;
    var impulseperimass = normal.clone().multiplyScalar(impulse);
    this.vel.addSelf(impulseperimass.multiplyScalar(1 / this.mass));
    
/*
    var vel = this.vel.clone();
    var restitution = this.restitution * obj.restitution;
    var vpar = normal.clone().multiplyScalar(vel.dot(normal) * restitution);
    var vper = vel.clone().subSelf(vpar);
    var vother = normal.clone().multiplyScalar(obj.vel.clone().dot(normal));
    var vfinal = vpar.clone().multiplyScalar(-1).addSelf(vper).addSelf(vother);
    this.setVelocity(vfinal);
*/
/*
    if(collision[0] == 0) {
        this.pos = $V(obj.pos).to3D().subtract(normal.multiply(this.radius + obj.radius + .1));
    }
*/
    //console.log(this.vel.add(normal.multiply(j / this.mass)));
    //this.setVelocity(this.vel.add(normal.multiply(j / this.mass)));
    //if (this.args.onbounce) this.args.onbounce(); // FIXME - use custom events
    elation.events.fire({type: 'bounce', element: this});
  }
  this.init();
});