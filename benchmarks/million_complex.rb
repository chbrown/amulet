$LOAD_PATH.unshift File.dirname(__FILE__) + '/../lib'
require 'rubygems'
require 'mustache'
 
class MillionComplex < Mustache
  self.path = File.dirname(__FILE__)
 
  def header
    "Colors"
  end
 
  def item
    items = []
    items << { :name => 'red', :current => true, :url => '#Red' }
    items << { :name => 'green', :current => false, :url => '#Green' }
    items << { :name => 'blue', :current => false, :url => '#Blue' }
    items
  end
 
  def link
    not self[:current]
  end
 
  def list
    not item.empty?
  end
 
  def empty
    item.empty?
  end
end
 
if $0 == __FILE__
  puts MillionComplex.to_html
  
  start = Time.now
  1000000.times {
    MillionComplex.to_html
  }
  diff = Time.now - start
  puts "Time taken: #{diff.to_s} seconds"
end